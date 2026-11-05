function abortError() {
  const error = new Error("Video frame capture was cancelled.");
  error.name = "AbortError";
  return error;
}

/**
 * Create a sequential, seek-based frame capture adapter for a local HTMLVideoElement.
 * The video is paused during analysis; call restore() in a finally block to restore
 * its original playhead and playback state. No frame collection is retained.
 */
export function createVideoFrameCapture(video, {
  createBitmap = globalThis.createImageBitmap,
  timeoutMs = 12000,
  seekToleranceSeconds = 0.025
} = {}) {
  if (!video || typeof video.addEventListener !== "function" ||
      typeof video.removeEventListener !== "function" ||
      typeof video.pause !== "function") {
    throw new TypeError("A local HTMLVideoElement-like object is required.");
  }
  if (typeof createBitmap !== "function") {
    throw new Error("createImageBitmap is not supported in this browser.");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("timeoutMs must be a positive finite number.");
  }
  if (!Number.isFinite(seekToleranceSeconds) || seekToleranceSeconds < 0) {
    throw new RangeError("seekToleranceSeconds must be a non-negative finite number.");
  }

  const originalTime = Number(video.currentTime) || 0;
  const wasPlaying = !video.paused;
  let disposed = false;
  let capturePending = false;
  video.pause();

  function waitForSeek(targetSeconds, signal) {
    if (signal?.aborted) return Promise.reject(abortError());
    if (!video.seeking && video.readyState >= 2 &&
        Math.abs(Number(video.currentTime) - targetSeconds) <= seekToleranceSeconds) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      let timer = null;
      const cleanup = () => {
        if (timer !== null) clearTimeout(timer);
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
        video.removeEventListener("abort", onAbort);
        signal?.removeEventListener("abort", onSignalAbort);
      };
      const onSeeked = () => {
        // currentTime changes before the browser has decoded the requested frame.
        // Do not treat the assignment itself as a completed seek.
        if (video.seeking || video.readyState < 2 ||
            Math.abs(Number(video.currentTime) - targetSeconds) > seekToleranceSeconds) return;
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error(video.error?.message || "Video decoding failed while seeking."));
      };
      const onAbort = () => {
        cleanup();
        reject(new Error("Video seeking was aborted."));
      };
      const onSignalAbort = () => {
        cleanup();
        reject(abortError());
      };

      video.addEventListener("seeked", onSeeked);
      video.addEventListener("error", onError);
      video.addEventListener("abort", onAbort);
      signal?.addEventListener("abort", onSignalAbort, { once: true });
      timer = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out while seeking to a video analysis frame."));
      }, timeoutMs);

      try {
        video.currentTime = targetSeconds;
      } catch (error) {
        cleanup();
        reject(error);
      }
      onSeeked();
    });
  }

  async function captureFrame(timestampMs, { signal } = {}) {
    if (disposed) throw new Error("Video frame capture adapter has been restored.");
    if (capturePending) throw new Error("Video frame capture is already running.");
    if (!Number.isFinite(timestampMs) || timestampMs < 0) {
      throw new RangeError("Frame timestamp must be a non-negative finite number.");
    }
    const durationMs = Number(video.duration) * 1000;
    if (!Number.isFinite(durationMs) || timestampMs >= durationMs) {
      throw new RangeError("Frame timestamp is outside the video duration.");
    }
    capturePending = true;
    try {
      await waitForSeek(timestampMs / 1000, signal);
      if (signal?.aborted) throw abortError();
      const bitmap = await createBitmap(video);
      if (!bitmap || typeof bitmap.close !== "function") {
        throw new TypeError("createImageBitmap did not return an ImageBitmap.");
      }
      if (signal?.aborted) {
        try { bitmap.close(); } catch {}
        throw abortError();
      }
      return bitmap;
    } finally {
      capturePending = false;
    }
  }

  async function restore() {
    if (disposed) return;
    if (capturePending) throw new Error("Cannot restore video while a frame capture is running.");
    disposed = true;
    try {
      if (Number.isFinite(originalTime) && Number(video.duration) > originalTime) {
        video.currentTime = originalTime;
      }
    } catch { /* The source may have become unavailable. */ }
    if (wasPlaying) {
      try {
        const playback = video.play?.();
        if (playback && typeof playback.catch === "function") playback.catch(() => {});
      } catch { /* Browser autoplay policy may prevent resuming playback. */ }
    }
  }

  return { captureFrame, restore };
}

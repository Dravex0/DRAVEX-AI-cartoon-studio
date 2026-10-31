/**
 * Wait until a scene video has decoded enough media to draw a real frame.
 * A loaded metadata header alone is not sufficient: videoWidth must be non-zero
 * and readyState must indicate that current frame data is available.
 */
export function waitForSceneVideoReady(video, { timeoutMs = 12000, signal } = {}) {
  if (!video || typeof video.addEventListener !== "function" ||
      typeof video.removeEventListener !== "function") {
    return Promise.reject(new TypeError("video must be an HTMLVideoElement-like event target."));
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new RangeError("timeoutMs must be a positive finite number."));
  }
  if (signal?.aborted) {
    const error = new Error("Waiting for scene video was aborted.");
    error.name = "AbortError";
    return Promise.reject(error);
  }

  const ready = () => video.readyState >= 2 && Number(video.videoWidth) > 0;
  if (ready()) return Promise.resolve(video);
  if (video.error) {
    return Promise.reject(new Error(video.error.message || "Scene video failed to load."));
  }

  return new Promise((resolve, reject) => {
    let timer = null;
    const cleanup = () => {
      if (timer !== null) clearTimeout(timer);
      video.removeEventListener("loadeddata", onProgress);
      video.removeEventListener("canplay", onProgress);
      video.removeEventListener("error", onError);
      video.removeEventListener("abort", onAbort);
      signal?.removeEventListener("abort", onSignalAbort);
    };
    const onProgress = () => {
      if (ready()) {
        cleanup();
        resolve(video);
      }
    };
    const onError = () => {
      cleanup();
      reject(new Error(video.error?.message || "Scene video failed while decoding."));
    };
    const onAbort = () => {
      cleanup();
      reject(new Error("Scene video loading was aborted."));
    };
    const onSignalAbort = () => {
      cleanup();
      const error = new Error("Waiting for scene video was aborted.");
      error.name = "AbortError";
      reject(error);
    };

    video.addEventListener("loadeddata", onProgress);
    video.addEventListener("canplay", onProgress);
    video.addEventListener("error", onError);
    video.addEventListener("abort", onAbort);
    signal?.addEventListener("abort", onSignalAbort, { once: true });
    timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for a decoded frame from the scene video."));
    }, timeoutMs);

    // Re-check after listeners are attached to close the readiness race.
    onProgress();
  });
}

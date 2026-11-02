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


/**
 * Sample decoded frames across a generated clip, not just its first frame.
 * The original playback position is restored even when a seek or decode fails.
 */
export async function validateSceneVideoPlayback(video, { timeoutMs = 12000, signal } = {}) {
  await waitForSceneVideoReady(video, { timeoutMs, signal });
  const duration = Number(video.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Scene video has no finite, positive duration.");
  }
  const originalTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  const targets = [...new Set([duration * 0.25, duration * 0.75])]
    .filter(time => time > 0.05 && time < duration - 0.05);

  const seekAndDecode = (target) => new Promise((resolve, reject) => {
    let timer = null;
    const cleanup = () => {
      if (timer !== null) clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const onSeeked = () => {
      if (video.readyState < 2 || Number(video.videoWidth) <= 0) {
        cleanup();
        reject(new Error("Scene video did not decode a frame after seeking."));
        return;
      }
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(video.error?.message || "Scene video failed while decoding a later frame."));
    };
    const onAbort = () => {
      cleanup();
      const error = new Error("Scene video validation was aborted.");
      error.name = "AbortError";
      reject(error);
    };

    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while decoding a later scene video frame."));
    }, timeoutMs);
    try {
      video.currentTime = target;
      // Some browsers resolve seeks synchronously when the target is buffered.
      if (!video.seeking && Math.abs(Number(video.currentTime) - target) < 0.05) onSeeked();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });

  try {
    for (const target of targets) {
      if (signal?.aborted) {
        const error = new Error("Scene video validation was aborted.");
        error.name = "AbortError";
        throw error;
      }
      await seekAndDecode(target);
    }
    return { duration, sampledFrames: targets.length };
  } finally {
    try {
      if (Number.isFinite(originalTime) && Math.abs(video.currentTime - originalTime) > 0.01) {
        video.currentTime = originalTime;
      }
    } catch {}
  }
}

/**
 * Wait until a generated scene image is decoded and safe to draw at its natural size.
 * With crossOrigin="anonymous", a CORS failure is surfaced as an image error.
 */
export function waitForSceneImageReady(image, { timeoutMs = 12000 } = {}) {
  if (!image || typeof image.addEventListener !== "function" ||
      typeof image.removeEventListener !== "function") {
    return Promise.reject(new TypeError("image must be an HTMLImageElement-like event target."));
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new RangeError("timeoutMs must be a positive finite number."));
  }
  const ready = () => image.complete && Number(image.naturalWidth) > 0;
  if (ready()) return Promise.resolve(image);
  if (image.complete) {
    return Promise.reject(new Error("Generated scene image failed to load or decode."));
  }

  return new Promise((resolve, reject) => {
    let timer = null;
    const cleanup = () => {
      if (timer !== null) clearTimeout(timer);
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onError);
    };
    const onLoad = () => {
      if (!ready()) {
        cleanup();
        reject(new Error("Generated scene image loaded without decoded pixels."));
        return;
      }
      cleanup();
      resolve(image);
    };
    const onError = () => {
      cleanup();
      reject(new Error("Generated scene image could not be loaded (network or CORS error)."));
    };

    image.addEventListener("load", onLoad);
    image.addEventListener("error", onError);
    timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for the generated scene image to decode."));
    }, timeoutMs);

    // Re-check after listeners are attached to close the readiness race.
    if (ready()) onLoad();
    else if (image.complete) onError();
  });
}

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

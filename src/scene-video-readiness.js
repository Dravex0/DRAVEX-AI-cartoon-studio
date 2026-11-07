/**
 * Return true only when a scene clip has a decoded frame and finite media dimensions/duration.
 * This stricter predicate is used by media coverage reports and full-film preflight.
 */
export function isSceneVideoDecoded(video) {
  return Boolean(video && Number(video.readyState) >= 2 &&
    Number(video.videoWidth) > 0 && Number(video.videoHeight) > 0 &&
    Number.isFinite(Number(video.duration)) && Number(video.duration) > 0);
}

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

  const ready = () => isSceneVideoDecoded(video);
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
/**
 * Rewind a scene clip and wait for the new frame to decode before export.
 * Setting currentTime can temporarily drop readyState to HAVE_METADATA; callers
 * must not treat the pre-seek decoded frame as proof that time zero is ready.
 */
export async function rewindSceneVideoAndWait(video, { timeoutMs = 12000, signal } = {}) {
  if (!video || typeof video.addEventListener !== "function" ||
      typeof video.removeEventListener !== "function") {
    throw new TypeError("video must be an HTMLVideoElement-like event target.");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("timeoutMs must be a positive finite number.");
  }
  if (signal?.aborted) {
    const error = new Error("Rewinding scene video was aborted.");
    error.name = "AbortError";
    throw error;
  }

  if (Number.isFinite(Number(video.currentTime)) && Number(video.currentTime) > 0.01) {
    await new Promise((resolve, reject) => {
      let timer = null;
      const cleanup = () => {
        if (timer !== null) clearTimeout(timer);
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
        signal?.removeEventListener("abort", onAbort);
      };
      const onSeeked = () => { cleanup(); resolve(); };
      const onError = () => {
        cleanup();
        reject(new Error(video.error?.message || "Scene video failed while seeking to its first frame."));
      };
      const onAbort = () => {
        cleanup();
        const error = new Error("Rewinding scene video was aborted.");
        error.name = "AbortError";
        reject(error);
      };
      video.addEventListener("seeked", onSeeked, { once: true });
      video.addEventListener("error", onError, { once: true });
      signal?.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for the scene video to seek to its first frame."));
      }, timeoutMs);
      try {
        video.currentTime = 0;
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  return waitForSceneVideoReady(video, { timeoutMs, signal });
}

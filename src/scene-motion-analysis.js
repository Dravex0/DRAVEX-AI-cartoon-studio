import { analyzeVideoFrameSequence } from "./video-frame-motion-metrics.js";

/**
 * Browser-local motion check for a decoded scene video.
 * Pixel-change heuristic only; it does not recognize semantic actions or quality.
 */
function waitForSeek(video, targetTime, timeoutMs) {
  if (Math.abs(Number(video.currentTime) - targetTime) < 0.015 && !video.seeking) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error(video.error?.message || "Video failed while seeking frames.")); };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    timer = setTimeout(() => { cleanup(); reject(new Error("Timed out while sampling a scene video frame.")); }, timeoutMs);
    try { video.currentTime = targetTime; } catch (error) { cleanup(); reject(error); }
  });
}
function framePixelValues(imageData) {
  const { data, width, height } = imageData;
  const pixelCount = width * height;
  const luminance = new Float32Array(pixelCount);
  for (let pixel = 0, offset = 0; pixel < pixelCount; pixel += 1, offset += 4) {
    const red = data[offset] / 255;
    const green = data[offset + 1] / 255;
    const blue = data[offset + 2] / 255;
    luminance[pixel] = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }
  return { luminance, rgba: data.slice() };
}
/**
 * Samples small frames locally and compares adjacent-frame luminance.
 * @returns {Promise<{status:string,sampleCount:number,meanPixelChange:number,changedPixelRatio:number,message:string}>}
 */
export async function analyzeSceneVideoMotion(video, {
  sampleCount = 5, width = 32, height = 32, pixelDeltaThreshold = 0.06,
  staticMotionThreshold = 0.008, changedPixelThreshold = 0.01,
  timeoutMs = 5000, canvasFactory = () => document.createElement("canvas")
} = {}) {
  if (!video || typeof video.addEventListener !== "function" || typeof video.removeEventListener !== "function") {
    throw new TypeError("video must be an HTMLVideoElement-like event target.");
  }
  if (!Number.isInteger(sampleCount) || sampleCount < 2 || sampleCount > 12) {
    throw new RangeError("sampleCount must be an integer from 2 to 12.");
  }
  if (![width, height].every(value => Number.isInteger(value) && value > 0 && value <= 128)) {
    throw new RangeError("Frame analysis dimensions must be integers from 1 to 128.");
  }
  if (!Number.isFinite(Number(video.duration)) || video.duration <= 0 ||
      !Number.isFinite(Number(video.videoWidth)) || video.videoWidth <= 0 || video.readyState < 2) {
    throw new Error("Scene video must have a decoded frame and a finite duration.");
  }
  if (typeof canvasFactory !== "function") throw new TypeError("canvasFactory must be a function.");
  const canvas = canvasFactory();
  const context = canvas?.getContext?.("2d", { willReadFrequently: true });
  if (!canvas || !context || typeof context.drawImage !== "function" || typeof context.getImageData !== "function") {
    throw new Error("A readable 2D canvas is required for local motion analysis.");
  }
  canvas.width = width;
  canvas.height = height;
  const wasPaused = Boolean(video.paused);
  const originalTime = Number(video.currentTime) || 0;
  const frames = [];
  video.pause?.();
  try {
    for (let index = 0; index < sampleCount; index += 1) {
      const fraction = 0.08 + (0.84 * index) / (sampleCount - 1);
      const targetTime = Math.min(Math.max(0, video.duration - 0.01), video.duration * fraction);
      await waitForSeek(video, targetTime, timeoutMs);
      context.drawImage(video, 0, 0, width, height);
      frames.push(framePixelValues(context.getImageData(0, 0, width, height)));
    }
  } catch (error) {
    if (error?.name === "SecurityError") {
      throw new Error("Video pixels are not readable by canvas (CORS restriction); motion analysis was skipped.");
    }
    throw error;
  } finally {
    try { await waitForSeek(video, Math.min(originalTime, Math.max(0, video.duration - 0.01)), timeoutMs); } catch {}
    if (!wasPaused) {
      const playback = video.play?.();
      if (playback && typeof playback.catch === "function") playback.catch(() => {});
    }
  }
  let totalChange = 0, changedPixels = 0, comparisons = 0;
  const pixelCount = width * height;
  for (let frame = 1; frame < frames.length; frame += 1) {
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const previous = frames[frame - 1];
      const current = frames[frame];
      const delta = Math.abs(current.luminance[pixel] - previous.luminance[pixel]);
      totalChange += delta;
      if (delta > 0 && delta >= pixelDeltaThreshold) changedPixels += 1;
      comparisons += 1;
    }
  }
  const meanPixelChange = comparisons ? totalChange / comparisons : 0;
  const changedPixelRatio = comparisons ? changedPixels / comparisons : 0;
  const numericPixelThreshold = Number(pixelDeltaThreshold);
  const rgbaPixelThreshold = Number.isFinite(numericPixelThreshold)
    ? Math.min(255, Math.max(0, numericPixelThreshold * 255))
    : 255;
  const colorSequence = analyzeVideoFrameSequence(
    frames.map(frame => frame.rgba),
    { pixelThreshold: rgbaPixelThreshold }
  );
  const meanColorChange = colorSequence.averageMeanAbsoluteDifference / 255;
  const colorChangedPixelRatio = colorSequence.averageChangedPixelRatio;
  const isLikelyStatic = meanPixelChange < staticMotionThreshold &&
    changedPixelRatio < changedPixelThreshold &&
    meanColorChange < staticMotionThreshold &&
    colorChangedPixelRatio < changedPixelThreshold;
  return {
    status: isLikelyStatic ? "likely-static" : "visible-change",
    sampleCount: frames.length,
    meanPixelChange: Number(meanPixelChange.toFixed(5)),
    changedPixelRatio: Number(changedPixelRatio.toFixed(4)),
    meanColorChange: Number(meanColorChange.toFixed(5)),
    colorChangedPixelRatio: Number(colorChangedPixelRatio.toFixed(4)),
    message: isLikelyStatic ? "Very little pixel change was detected between sampled frames." : "Pixel changes were detected between sampled frames."
  };
}

/**
 * Capture a small, browser-local contact sheet source from a decoded scene clip.
 * Returned data URLs are ephemeral UI evidence; this function does not upload or persist frames.
 */
export async function captureSceneVideoFrameSamples(video, {
  sampleCount = 3, width = 160, height = 90, timeoutMs = 5000,
  canvasFactory = () => document.createElement("canvas")
} = {}) {
  if (!video || typeof video.addEventListener !== "function" || typeof video.removeEventListener !== "function") {
    throw new TypeError("video must be an HTMLVideoElement-like event target.");
  }
  if (!Number.isInteger(sampleCount) || sampleCount < 1 || sampleCount > 5) {
    throw new RangeError("sampleCount must be an integer from 1 to 5.");
  }
  if (![width, height].every(value => Number.isInteger(value) && value > 0 && value <= 512)) {
    throw new RangeError("Frame capture dimensions must be integers from 1 to 512.");
  }
  if (!Number.isFinite(Number(video.duration)) || video.duration <= 0 ||
      !Number.isFinite(Number(video.videoWidth)) || video.videoWidth <= 0 || video.readyState < 2) {
    throw new Error("Scene video must have a decoded frame and a finite duration.");
  }
  if (typeof canvasFactory !== "function") throw new TypeError("canvasFactory must be a function.");
  const canvas = canvasFactory();
  const context = canvas?.getContext?.("2d");
  if (!canvas || !context || typeof context.drawImage !== "function" || typeof canvas.toDataURL !== "function") {
    throw new Error("A readable canvas with data URL support is required for local frame capture.");
  }
  canvas.width = width;
  canvas.height = height;
  const wasPaused = Boolean(video.paused);
  const originalTime = Number(video.currentTime) || 0;
  const samples = [];
  video.pause?.();
  try {
    for (let index = 0; index < sampleCount; index += 1) {
      const fraction = sampleCount === 1 ? 0.5 : 0.08 + (0.84 * index) / (sampleCount - 1);
      const time = Math.min(Math.max(0, video.duration - 0.01), video.duration * fraction);
      await waitForSeek(video, time, timeoutMs);
      context.drawImage(video, 0, 0, width, height);
      samples.push({ time: Number(time.toFixed(2)), dataUrl: canvas.toDataURL("image/jpeg", 0.72) });
    }
  } catch (error) {
    if (error?.name === "SecurityError") {
      throw new Error("Video pixels are not readable by canvas (CORS restriction); frame capture was skipped.");
    }
    throw error;
  } finally {
    try { await waitForSeek(video, Math.min(originalTime, Math.max(0, video.duration - 0.01)), timeoutMs); } catch {}
    if (!wasPaused) {
      const playback = video.play?.();
      if (playback && typeof playback.catch === "function") playback.catch(() => {});
    }
  }
  return samples;
}


import { createVideoFrameCapture } from "./video-frame-capture.js";
import { waitForSceneVideoReady } from "./scene-video-readiness.js";

function abortError() {
  const error = new Error("Last-frame extraction was cancelled.");
  error.name = "AbortError";
  return error;
}

/**
 * Decode a generated scene clip and turn its final decoded frame into a PNG Blob.
 * This is intended for image-to-video continuity handoff, not for final export.
 */
export async function captureLastFrameImage(videoBlob, {
  signal,
  createVideoElement = () => document.createElement("video"),
  createCanvas = () => document.createElement("canvas"),
  createObjectURL = blob => URL.createObjectURL(blob),
  revokeObjectURL = url => URL.revokeObjectURL(url),
  waitForReady = waitForSceneVideoReady,
  createFrameCapture = createVideoFrameCapture,
  timeoutMs = 20000
} = {}) {
  if (!(videoBlob instanceof Blob) || videoBlob.size <= 0) {
    throw new TypeError("A non-empty previous scene video Blob is required.");
  }
  if (signal?.aborted) throw abortError();

  const video = createVideoElement();
  if (!video || typeof video !== "object") {
    throw new TypeError("A video element is required for last-frame extraction.");
  }

  let objectUrl = "";
  let frameCapture = null;
  let bitmap = null;
  try {
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    objectUrl = createObjectURL(videoBlob);
    video.src = objectUrl;
    video.load?.();

    await waitForReady(video, { timeoutMs, signal });
    if (signal?.aborted) throw abortError();

    const duration = Number(video.duration);
    if (!Number.isFinite(duration) || duration <= 0.05) {
      throw new Error("Previous scene video is too short to extract a reliable final frame.");
    }

    frameCapture = createFrameCapture(video);
    const safetyOffsetSeconds = Math.min(0.1, Math.max(0.025, duration * 0.02));
    const timestampMs = Math.max(0, duration * 1000 - safetyOffsetSeconds * 1000);
    bitmap = await frameCapture.captureFrame(timestampMs, { signal });
    if (signal?.aborted) throw abortError();

    const canvas = createCanvas();
    if (!canvas || typeof canvas.getContext !== "function" || typeof canvas.toBlob !== "function") {
      throw new Error("Canvas PNG encoding is not supported in this browser.");
    }
    canvas.width = Number(bitmap.width);
    canvas.height = Number(bitmap.height);
    if (!(canvas.width > 0) || !(canvas.height > 0)) {
      throw new Error("The decoded final frame has invalid dimensions.");
    }
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create a 2D canvas context for the final frame.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const imageBlob = await new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob || blob.size <= 0) {
          reject(new Error("The final frame could not be encoded as a PNG image."));
          return;
        }
        resolve(blob);
      }, "image/png");
    });
    if (signal?.aborted) throw abortError();
    return imageBlob;
  } finally {
    try { bitmap?.close?.(); } catch {}
    if (frameCapture) {
      try { await frameCapture.restore(); } catch {}
    }
    try { video.pause?.(); } catch {}
    try { video.removeAttribute?.("src"); } catch {}
    try { video.load?.(); } catch {}
    if (objectUrl) {
      try { revokeObjectURL(objectUrl); } catch {}
    }
  }
}

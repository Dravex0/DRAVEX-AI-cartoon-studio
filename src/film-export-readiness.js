const DEFAULT_TIMEOUT_MS = 15000;

export function validateExportTracks(stream, { audioRequired = false } = {}) {
  if (!stream || typeof stream.getVideoTracks !== "function" || typeof stream.getAudioTracks !== "function") {
    throw new TypeError("A composed export MediaStream is required.");
  }
  if (stream.getVideoTracks().length === 0) throw new Error("The export stream has no video track.");
  if (audioRequired && stream.getAudioTracks().length === 0) {
    throw new Error("Audio was requested, but the export stream has no audio track.");
  }
  return { videoTracks: stream.getVideoTracks().length, audioTracks: stream.getAudioTracks().length };
}

export async function waitForExportVideoReady(blob, {
  createVideoElement = () => document.createElement("video"),
  createObjectURL = value => URL.createObjectURL(value),
  revokeObjectURL = value => URL.revokeObjectURL(value),
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  if (!(blob instanceof Blob) || blob.size === 0) throw new TypeError("A non-empty exported video Blob is required.");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError("timeoutMs must be a positive finite number.");
  const url = createObjectURL(blob);
  let video = null;
  try {
    // Keep player creation inside the protected lifetime so the object URL is
    // released even when the browser cannot allocate a temporary video element.
    video = createVideoElement();
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        video.removeEventListener("loadeddata", onReady);
        video.removeEventListener("error", onError);
        error ? reject(error) : resolve();
      };
      const onReady = () => {
        if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
          finish(new Error("Exported video has no decodable frame or valid dimensions."));
        } else finish();
      };
      const onError = () => finish(new Error(video.error?.message || "Exported video could not be decoded."));
      const timer = setTimeout(() => finish(new Error("Timed out waiting for the exported video to decode.")), timeoutMs);
      video.addEventListener("loadeddata", onReady);
      video.addEventListener("error", onError);
      video.src = url;
      if (video.readyState >= 2) onReady();
    });
    return { width: video.videoWidth, height: video.videoHeight, readyState: video.readyState };
  } finally {
    // Cleanup is best-effort, but every release step is attempted independently.
    try { video?.pause?.(); } catch {}
    try { video?.removeAttribute?.("src"); } catch {}
    try { video?.load?.(); } catch {}
    try { revokeObjectURL(url); } catch {}
  }
}

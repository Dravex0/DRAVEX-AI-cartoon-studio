/**
 * Keep scene video elements aligned with the active storyboard scene.
 * Inactive videos are paused; the active video can be restarted at scene entry.
 */
export function syncSceneVideoPlayback({
  cache,
  activeKey = null,
  shouldPlay = false,
  restart = false
} = {}) {
  if (!(cache instanceof Map)) {
    throw new TypeError("cache must be a Map of scene video entries.");
  }
  if (typeof shouldPlay !== "boolean" || typeof restart !== "boolean") {
    throw new TypeError("shouldPlay and restart must be booleans.");
  }

  for (const [key, entry] of cache) {
    const video = entry?.video;
    if (!video || typeof video.pause !== "function" || typeof video.play !== "function") {
      throw new TypeError("Every scene video entry must contain a playable video element.");
    }

    if (key !== activeKey || !shouldPlay) {
      if (!video.paused) video.pause();
      continue;
    }

    if (restart) {
      try { video.currentTime = 0; } catch { /* The media may not be seekable yet. */ }
    }
    if (video.paused) {
      const result = video.play();
      if (result && typeof result.catch === "function") {
        result.catch(() => {});
      }
    }
  }
}

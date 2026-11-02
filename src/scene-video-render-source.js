/**
 * Return a scene video only when the browser has decoded a drawable frame.
 * The same selection rule is used by the canvas renderer and integration tests.
 */
export function getDrawableSceneVideo(cache, sceneId) {
  if (!(cache instanceof Map)) {
    throw new TypeError("cache must be a Map of scene video entries.");
  }
  const key = String(sceneId || "").trim();
  if (!key) return null;
  const video = cache.get(key)?.video;
  if (!video || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return null;
  }
  return video;
}

/**
 * Build an honest per-scene media report.
 * A scene counts as video only when its scene ID is present in the
 * caller's decoded-video cache; a generated still image is not a video clip.
 */
export function buildSceneMediaReport(scenes, videoKeys = []) {
  if (!Array.isArray(scenes)) throw new TypeError("scenes must be an array.");
  const keys = videoKeys instanceof Set ? videoKeys : new Set(videoKeys);
  const items = scenes.map((scene, index) => {
    const id = String(scene?.id ?? "");
    const hasVideo = Boolean(id) && keys.has(id);
    return {
      id,
      index,
      title: String(scene?.title ?? `Scene ${index + 1}`),
      mediaType: hasVideo ? "video" : "still"
    };
  });
  const videoScenes = items.filter(item => item.mediaType === "video").length;
  return {
    totalScenes: items.length,
    videoScenes,
    stillScenes: items.length - videoScenes,
    complete: items.length > 0 && videoScenes === items.length,
    items
  };
}

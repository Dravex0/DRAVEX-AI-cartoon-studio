/**
 * Resolve the still image used by one storyboard scene.
 * A selected local ComfyUI image applies only to the currently selected scene;
 * other scenes continue to use their generated image URL or explicit AI Horde fallback.
 */
export function resolveSceneImageSource({
  mode,
  sceneIndex,
  activeSceneIndex,
  localImage,
  generatedImageUrl
} = {}) {
  if (
    mode === 'comfyui' &&
    Number.isInteger(sceneIndex) &&
    sceneIndex === activeSceneIndex &&
    localImage &&
    typeof localImage.arrayBuffer === 'function'
  ) {
    return { kind: 'blob', image: localImage };
  }
  const url = String(generatedImageUrl || '').trim();
  return url ? { kind: 'url', url } : { kind: 'missing' };
}

/**
 * Choose the ComfyUI task from the scene's available visual source.
 * A missing still image is valid for local prompt-only video generation.
 */
export function resolveSceneVideoTaskType({ mode, imageSourceKind } = {}) {
  if (String(mode || '').trim().toLowerCase() === 'comfyui' && imageSourceKind === 'missing') {
    return 'text-to-video';
  }
  return 'image-to-video';
}

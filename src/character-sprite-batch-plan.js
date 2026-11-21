import { buildCharacterSpriteAssetPlan } from './character-sprite-asset-plan.js';

/**
 * Merge the currently edited scene fields into a scene snapshot without mutating
 * the saved scene. Keep the canonical prompt field aligned with the image prompt.
 */
export function mergeCharacterSpriteSceneOverrides(source, overrides = null) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const scene = { ...source };
  if (overrides && typeof overrides === 'object' && !Array.isArray(overrides)) {
    Object.assign(scene, overrides);
    if (Object.prototype.hasOwnProperty.call(overrides, 'imagePrompt')) {
      scene.prompt = String(overrides.imagePrompt ?? '');
    }
  }
  return scene;
}

/**
 * Build scene-scoped sprite plans for every storyboard scene.
 * Current editor values override only the currently open scene; all other scenes
 * are planned from their saved metadata. This function is local and side-effect free.
 */
export function buildCharacterSpriteBatchPlan(scenes = [], characterBible = [], {
  currentSceneIndex = -1,
  currentSceneOverrides = null
} = {}) {
  if (!Array.isArray(scenes)) return [];
  return scenes.flatMap((source, sceneIndex) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return [];
    const sceneId = String(source.id || `scene_${sceneIndex + 1}`).trim();
    const overrides = sceneIndex === currentSceneIndex ? currentSceneOverrides : null;
    const scene = mergeCharacterSpriteSceneOverrides(source, overrides);
    if (!scene) return [];
    scene.id = sceneId;
    // Resolve this after editor overrides so unsaved motionPrompt values win.
    scene.visibleAction = scene.visibleAction || scene.motionPrompt || '';
    const plans = buildCharacterSpriteAssetPlan(scene, characterBible);
    return plans.length ? [{ sceneIndex, sceneId, plans }] : [];
  });
}

import { buildCharacterSpriteAssetPlan } from './character-sprite-asset-plan.js';

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
    const scene = {
      ...source,
      ...(sceneIndex === currentSceneIndex && currentSceneOverrides && typeof currentSceneOverrides === 'object'
        ? currentSceneOverrides
        : {}),
      id: sceneId
    };
    // Resolve this after editor overrides so unsaved motionPrompt values win.
    scene.visibleAction = scene.visibleAction || scene.motionPrompt || '';
    const plans = buildCharacterSpriteAssetPlan(scene, characterBible);
    return plans.length ? [{ sceneIndex, sceneId, plans }] : [];
  });
}

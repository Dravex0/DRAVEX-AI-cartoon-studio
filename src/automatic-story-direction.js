import { directStoryboardWithLocalAI } from './local-story-director.js';

/**
 * Apply the existing local AI director to the exact storyboard that will be rendered.
 * A missing model or rejected candidate keeps the original storyboard unchanged.
 */
export async function directStoryboardForFilm({
  runtime,
  basePlan,
  storyText = '',
  language = 'English',
  character = 'Main character',
  characterBible = []
} = {}) {
  const fallbackScenes = Array.isArray(basePlan?.scenes) ? basePlan.scenes : [];
  if (!fallbackScenes.length) {
    return { usedLocalModel: false, scenes: fallbackScenes, fallbackReason: 'storyboard-empty' };
  }
  if (!runtime || runtime.status?.loaded !== true || typeof runtime.generate !== 'function') {
    return { usedLocalModel: false, scenes: fallbackScenes, fallbackReason: 'local-model-not-loaded' };
  }

  const result = await directStoryboardWithLocalAI({
    runtime,
    basePlan,
    storyText,
    language,
    character,
    characterBible
  });
  if (!result.usedLocalModel) {
    return {
      ...result,
      scenes: fallbackScenes,
      usedLocalModel: false
    };
  }
  return result;
}

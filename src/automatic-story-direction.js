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
  characterBible = [],
  signal = null
} = {}) {
  const fallbackScenes = Array.isArray(basePlan?.scenes) ? basePlan.scenes : [];
  if (signal?.aborted) {
    return { status: 'cancelled', usedLocalModel: false, scenes: fallbackScenes, fallbackReason: 'cancelled' };
  }
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
    characterBible,
    signal
  });
  if (signal?.aborted || result.fallbackReason === 'cancelled') {
    return { ...result, status: 'cancelled', scenes: fallbackScenes, usedLocalModel: false };
  }
  if (!result.usedLocalModel) {
    return {
      ...result,
      scenes: fallbackScenes,
      usedLocalModel: false
    };
  }
  return result;
}

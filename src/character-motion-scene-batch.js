/**
 * Batch-generate conservative whole-sprite motion timelines for scenes that
 * already have character layers and validated, source-grounded action phases.
 * Existing timelines and scenes without sprite assets are preserved unchanged.
 */
export function generateCharacterMotionTimelinesForScenes(scenes, createTimeline) {
  if (!Array.isArray(scenes)) {
    return {
      scenes: [],
      generatedScenes: 0,
      generatedActions: 0,
      scenesWithoutSprites: 0,
      scenesWithoutActions: 0,
      preservedTimelines: 0,
      skipped: []
    };
  }
  if (typeof createTimeline !== 'function') {
    throw new TypeError('A character motion timeline factory is required.');
  }

  let generatedScenes = 0;
  let generatedActions = 0;
  let scenesWithoutSprites = 0;
  let scenesWithoutActions = 0;
  let preservedTimelines = 0;
  const skipped = [];

  const updatedScenes = scenes.map((scene, index) => {
    const meta = scene && typeof scene === 'object' && !Array.isArray(scene) ? scene : {};
    const layers = Array.isArray(meta.characterLayers) ? meta.characterLayers : [];
    if (!layers.length) {
      scenesWithoutSprites++;
      return scene;
    }
    if (Array.isArray(meta.characterMotionTimeline?.phases) && meta.characterMotionTimeline.phases.length) {
      preservedTimelines++;
      return scene;
    }

    let result;
    try {
      result = createTimeline(meta, layers);
    } catch (error) {
      scenesWithoutActions++;
      skipped.push({
        sceneIndex: index,
        reason: String(error?.message || 'motion-timeline-generation-failed').slice(0, 500)
      });
      return scene;
    }

    if (!result?.timeline || !Array.isArray(result.timeline.phases) || !result.timeline.phases.length) {
      scenesWithoutActions++;
      if (result?.reason) skipped.push({ sceneIndex: index, reason: String(result.reason).slice(0, 500) });
      const skippedActions = Array.isArray(result?.skipped) ? result.skipped.length : 0;
      if (skippedActions) skipped.push({ sceneIndex: index, skippedActions });
      return scene;
    }

    generatedScenes++;
    generatedActions += Number.isFinite(result.generatedCount) ? Math.max(0, result.generatedCount) : 0;
    const skippedActions = Array.isArray(result.skipped) ? result.skipped.length : 0;
    if (skippedActions) skipped.push({ sceneIndex: index, skippedActions });
    return { ...meta, characterMotionTimeline: result.timeline };
  });

  return {
    scenes: updatedScenes,
    generatedScenes,
    generatedActions,
    scenesWithoutSprites,
    scenesWithoutActions,
    preservedTimelines,
    skipped
  };
}

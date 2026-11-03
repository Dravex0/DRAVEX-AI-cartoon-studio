/**
 * Generate character-rig timelines for every eligible scene without mutating input.
 * Existing timelines are preserved; scenes without validated rigs are never guessed.
 */
export function generateCharacterRigTimelinesForScenes(scenes, createTimeline) {
  if (!Array.isArray(scenes)) {
    return {
      scenes: [],
      generatedScenes: 0,
      generatedActions: 0,
      scenesWithoutRig: 0,
      scenesWithoutActions: 0,
      preservedTimelines: 0,
      skipped: []
    };
  }
  if (typeof createTimeline !== 'function') {
    throw new TypeError('A character rig timeline factory is required.');
  }

  let generatedScenes = 0;
  let generatedActions = 0;
  let scenesWithoutRig = 0;
  let scenesWithoutActions = 0;
  let preservedTimelines = 0;
  const skipped = [];

  const updatedScenes = scenes.map((scene, index) => {
    const meta = scene && typeof scene === 'object' && !Array.isArray(scene) ? scene : {};
    const rigs = Array.isArray(meta.characterRigs) ? meta.characterRigs : [];
    if (!rigs.length) {
      scenesWithoutRig++;
      return scene;
    }
    if (Array.isArray(meta.characterRigTimeline?.keyframes) && meta.characterRigTimeline.keyframes.length) {
      preservedTimelines++;
      return scene;
    }

    let result;
    try {
      result = createTimeline(meta, rigs);
    } catch (error) {
      scenesWithoutActions++;
      skipped.push({
        sceneIndex: index,
        reason: String(error?.message || 'timeline-generation-failed').slice(0, 500)
      });
      return scene;
    }

    if (!result?.timeline || !Array.isArray(result.timeline.keyframes) || !result.timeline.keyframes.length) {
      scenesWithoutActions++;
      if (result?.reason) skipped.push({ sceneIndex: index, reason: String(result.reason).slice(0, 500) });
      return scene;
    }

    generatedScenes++;
    generatedActions += Number.isFinite(result.generatedCount) ? Math.max(0, result.generatedCount) : 0;
    const skippedActions = Array.isArray(result.skipped) ? result.skipped.length : 0;
    if (skippedActions) skipped.push({ sceneIndex: index, skippedActions });
    return { ...meta, characterRigTimeline: result.timeline };
  });

  return {
    scenes: updatedScenes,
    generatedScenes,
    generatedActions,
    scenesWithoutRig,
    scenesWithoutActions,
    preservedTimelines,
    skipped
  };
}

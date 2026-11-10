import { validateCharacterRigTimeline } from './character-rig-timeline.js';

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
    if (meta.characterRigTimeline != null && validateCharacterRigTimeline(meta.characterRigTimeline).passed) {
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

    if (!result?.timeline) {
      scenesWithoutActions++;
      if (result?.reason) skipped.push({ sceneIndex: index, reason: String(result.reason).slice(0, 500) });
      return scene;
    }
    const timelineReport = validateCharacterRigTimeline(result.timeline);
    if (!timelineReport.passed) {
      scenesWithoutActions++;
      skipped.push({
        sceneIndex: index,
        reason: 'generated-rig-timeline-invalid',
        issues: timelineReport.issues.map(issue => issue.code)
      });
      return scene;
    }

    generatedScenes++;
    generatedActions += Number.isFinite(result.generatedCount) ? Math.max(0, result.generatedCount) : 0;
    const skippedActions = Array.isArray(result.skipped) ? result.skipped.length : 0;
    if (skippedActions) skipped.push({ sceneIndex: index, skippedActions });
    return { ...meta, characterRigTimeline: timelineReport.timeline };
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

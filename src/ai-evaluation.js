import { normalizeScenes } from './scene-model.js';

const normalizeText = value => String(value ?? '').toLocaleLowerCase().normalize('NFKC')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const VAGUE_ACTION = /^(?:stands? there|looks? around|waits?|nothing happens|персонаж стоит|стоит|смотрит вокруг|жд[её]т|está quieto|mira alrededor)$/iu;

function percentage(value, total) {
  return total > 0 ? Math.round((value / total) * 100) : null;
}

function scoreUnique(values) {
  const normalized = values.map(normalizeText).filter(Boolean);
  return percentage(new Set(normalized).size, values.length);
}

/**
 * Evaluate a storyboard against explicit, text-verifiable learning targets.
 * This is a benchmark harness, not a neural model and not visual understanding.
 */
export function evaluateStoryboard({
  scenes: rawScenes,
  expectedSceneCount = null,
  expectedStoryDetails = [],
  characterRequirements = [],
  requireProductionFields = false
} = {}) {
  const scenes = normalizeScenes(rawScenes);
  const issues = [];
  const validCount = Number.isInteger(expectedSceneCount) && expectedSceneCount > 0
    ? scenes.length === expectedSceneCount
    : scenes.length >= 3 && scenes.length <= 8;

  if (!validCount) issues.push({
    skill: 'story-structure',
    code: 'scene-count-mismatch',
    message: 'The storyboard scene count does not match the benchmark requirement.'
  });

  const actionable = scenes.filter(scene => {
    const action = scene.visibleAction.trim();
    return action.length >= 24 && !VAGUE_ACTION.test(action);
  });
  if (actionable.length !== scenes.length) issues.push({
    skill: 'action-planning',
    code: 'weak-or-missing-action',
    message: 'One or more scenes lack a sufficiently specific visible action.'
  });

  const actionDiversity = scoreUnique(scenes.map(scene => scene.visibleAction));
  const cameraDiversity = scoreUnique(scenes.map(scene => scene.camera));
  if (actionDiversity !== null && actionDiversity < 80) issues.push({
    skill: 'action-diversity',
    code: 'repeated-actions',
    message: 'Scene actions repeat too often.'
  });
  if (cameraDiversity !== null && cameraDiversity < 60) issues.push({
    skill: 'camera-language',
    code: 'repeated-camera-plans',
    message: 'Camera plans lack sufficient variety.'
  });

  const storyDetails = Array.isArray(expectedStoryDetails) ? expectedStoryDetails : [];
  let sourceFidelity = null;
  if (storyDetails.length) {
    const assigned = scenes.map(scene => scene.storyDetail || '');
    const preserved = storyDetails.filter(detail =>
      assigned.reduce((count, value) => count + (value.includes(detail) ? 1 : 0), 0) === 1
    ).length;
    sourceFidelity = percentage(preserved, storyDetails.length);
    if (sourceFidelity < 100) issues.push({
      skill: 'source-fidelity',
      code: 'source-detail-lost-or-repeated',
      message: 'A required source-story detail was lost or assigned more than once.'
    });
  }

  let characterConsistency = null;
  if (Array.isArray(characterRequirements) && characterRequirements.length) {
    const satisfied = characterRequirements.filter(requirement => {
      const scene = scenes.find(item => item.id === requirement.sceneId);
      return scene && scene.characters.some(name =>
        name.toLocaleLowerCase() === String(requirement.characterId ?? '').toLocaleLowerCase()
      );
    }).length;
    characterConsistency = percentage(satisfied, characterRequirements.length);
    if (characterConsistency < 100) issues.push({
      skill: 'character-continuity',
      code: 'required-character-missing',
      message: 'A required character is missing from one or more assigned scenes.'
    });
  }

  let productionCompleteness = null;
  if (requireProductionFields) {
    const complete = scenes.filter(scene =>
      Boolean(scene.imagePrompt && scene.motionPrompt && scene.startState && scene.endState)
    ).length;
    productionCompleteness = percentage(complete, scenes.length);
    if (productionCompleteness < 100) issues.push({
      skill: 'scene-production',
      code: 'production-fields-incomplete',
      message: 'One or more scenes are missing image, motion, or continuity instructions.'
    });
  }

  const metrics = {
    storyStructure: validCount ? 100 : 0,
    actionSpecificity: percentage(actionable.length, scenes.length),
    actionDiversity,
    cameraVariety: cameraDiversity,
    sourceFidelity,
    characterConsistency,
    productionCompleteness
  };
  const measured = Object.values(metrics).filter(value => value !== null);
  const overallScore = measured.length
    ? Math.round(measured.reduce((sum, value) => sum + value, 0) / measured.length)
    : 0;

  return {
    schemaVersion: 1,
    evaluatedSceneCount: scenes.length,
    overallScore,
    metrics,
    passed: overallScore >= 85 && issues.length === 0,
    issues,
    limitations: [
      'Scores measure explicit text structure only; they do not prove story quality or visual correctness.',
      'Character checks verify scene membership, not visual identity across rendered frames.',
      'No model is trained or updated by this evaluator.'
    ]
  };
}

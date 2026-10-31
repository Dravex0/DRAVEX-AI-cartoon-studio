import { normalizeScene, SCENE_DURATION_MIN, SCENE_DURATION_MAX } from './scene-model.js';
import { validateCharacterActionTimeline } from './character-action-timeline.js';
import { buildCharacterSpriteAssetPlan } from './character-sprite-asset-plan.js';
import { buildSceneBackgroundPrompt } from './scene-background-prompt.js';

const safe = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const list = values => Array.isArray(values) ? values.map(value => safe(value, 500)).filter(Boolean) : [];

function characterDetails(scene, characterBible) {
  const hasExplicitCast = Array.isArray(scene?.characters);
  const names = new Set(list(scene?.characters).map(name => name.toLocaleLowerCase()));
  const entries = (Array.isArray(characterBible) ? characterBible : [])
    .filter(entry => {
      const id = safe(entry?.characterId, 120).toLocaleLowerCase();
      return id && (!hasExplicitCast || names.has(id));
    });
  const seen = new Set();
  return entries.map(entry => [
    entry.characterId, entry.species, entry.ageRange, entry.visualDescription, entry.bodyShape,
    entry.hair, entry.eyeColor, entry.silhouette, entry.clothing, entry.colors,
    entry.signatureAccessories, entry.distinctiveFeatures
  ].map(value => safe(value, 700)).filter(Boolean).join(' — '))
    .filter(Boolean)
    .filter(details => {
      const key = details.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Creates a provider-neutral still-image prompt without calling a paid or remote service. */
export function buildImageGenerationPrompt(scene = {}, characterBible = [], options = {}) {
  const characterLock = characterDetails(scene, characterBible);
  return [
    safe(scene.imagePrompt) || safe(scene.prompt) || safe(scene.description),
    safe(scene.location) && `Location: ${safe(scene.location, 500)}`,
    safe(scene.timeOfDay) && `Time: ${safe(scene.timeOfDay, 120)}`,
    safe(scene.camera) && `Composition and camera: ${safe(scene.camera, 1000)}`,
    characterLock.length && `Character appearance reference: ${characterLock.join(' | ')}`,
    safe(scene.continuityLock) && `Continuity lock: ${safe(scene.continuityLock, 2000)}`,
    options.includeNegative !== false && safe(scene.negativePrompt) && `Avoid: ${safe(scene.negativePrompt, 2000)}`,
    'Create one coherent still frame. Preserve the specified character identities and visual continuity. Do not add captions, logos, or watermarks.'
  ].filter(Boolean).join('\n\n');
}

/** Format validated action phases for downstream motion-generation providers. */
function actionTimelineInstructions(scene = {}) {
  if (scene.actionTimeline == null) return '';
  const report = validateCharacterActionTimeline(scene);
  if (!report.passed) return '';
  const duration = Number.isFinite(Number(scene.durationSeconds)) ? Number(scene.durationSeconds) : 3;
  const phases = scene.actionTimeline.phases.map(phase => {
    const startSeconds = (Number(phase.start) * duration).toFixed(2);
    const endSeconds = (Number(phase.end) * duration).toFixed(2);
    const target = phase.targetId ? `; target: ${safe(phase.targetId, 120)}` : '';
    return `- ${safe(phase.phase, 24)} (${Math.round(phase.start * 100)}%-${Math.round(phase.end * 100)}%; ${startSeconds}-${endSeconds}s): ${safe(phase.description, 700)}; actor: ${safe(phase.actorId, 120)}${target}`;
  });
  return [
    'Character action timeline (follow these phases in order):\n' + phases.join('\n'),
    'Temporal motion constraints: keep the action continuous across phase boundaries; do not teleport, reset the pose, or jump to a new screen position between phases.',
    "Preserve each character's identity, body proportions, clothing, facing direction, and screen-space position unless the phase description explicitly changes them.",
    'When a phase names a target, make the actor interact with that exact target; preserve believable contact, hand/paw occupancy, and object ownership through the interaction and the stated end state.',
    'Only the listed actor performs the phase action. Other characters remain stable unless they have their own explicit phase; do not invent extra gestures, reactions, props, or story events.',
    'Respect the phase time ranges as relative timing within this scene; use smooth anticipation, movement, and settling rather than compressing every phase into one instant.'
  ].join('\n');
}

/** Creates a motion-only instruction and keeps the still image description separate. */
export function buildMotionGenerationPrompt(scene = {}, characterBible = []) {
  const characterLock = characterDetails(scene, characterBible);
  return [
    safe(scene.motionPrompt) || safe(scene.visibleAction),
    safe(scene.startState) && `Start state: ${safe(scene.startState, 1000)}`,
    safe(scene.endState) && `End state: ${safe(scene.endState, 1000)}`,
    actionTimelineInstructions(scene),
    safe(scene.camera) && `Camera movement: ${safe(scene.camera, 1000)}`,
    characterLock.length && `Keep these character designs unchanged: ${characterLock.join(' | ')}`,
    safe(scene.continuityLock) && `Continuity lock: ${safe(scene.continuityLock, 2000)}`,
    safe(scene.negativePrompt) && `Avoid: ${safe(scene.negativePrompt, 2000)}`,
    'Animate only the described action. Preserve the scene composition and character identity; do not introduce new objects or characters.'
  ].filter(Boolean).join('\n\n');
}

/**
 * Converts a storyboard scene into a canonical, provider-neutral production record.
 * Missing start/end states remain missing: this function does not invent story facts.
 */
export function buildProductionScene(scene = {}, characterBible = [], options = {}) {
  const normalized = normalizeScene(scene, Number.isInteger(options.index) ? options.index : 0);
  const imagePrompt = normalized.imagePrompt || [
    normalized.title,
    normalized.storyDetail,
    normalized.visibleAction
  ].filter(Boolean).join('. ');
  const motionPrompt = normalized.motionPrompt || normalized.visibleAction;
  const prepared = {
    ...scene,
    ...normalized,
    imagePrompt,
    motionPrompt,
    negativePrompt: normalized.negativePrompt || safe(options.negativePrompt, 2000)
  };
  const readinessInput = { ...prepared };
  if (scene.durationSeconds !== undefined) readinessInput.durationSeconds = scene.durationSeconds;
  else if (scene.duration !== undefined) readinessInput.duration = scene.duration;
  return {
    ...prepared,
    imageGenerationPrompt: buildImageGenerationPrompt(prepared, characterBible, options),
    motionGenerationPrompt: buildMotionGenerationPrompt(prepared, characterBible),
    characterSpriteAssetPlan: buildCharacterSpriteAssetPlan(prepared, characterBible),
    sceneBackgroundPlan: buildSceneBackgroundPrompt(prepared),
    productionReadiness: validateSceneProductionReadiness(readinessInput, characterBible)
  };
}

/** Validate required fields and references before sending a scene to a provider. */
export function validateSceneProductionReadiness(scene = {}, characterBible = []) {
  const issues = [];
  if (scene.actionTimeline != null) {
    const timelineReport = validateCharacterActionTimeline(scene);
    if (!timelineReport.passed) {
      issues.push({ code: 'invalid-action-timeline', field: 'actionTimeline', details: timelineReport.issues });
    }
  }
  if (!safe(scene.title, 200)) issues.push({ code: 'missing-title', field: 'title' });
  if (!safe(scene.imagePrompt) && !safe(scene.prompt) && !safe(scene.description)) issues.push({ code: 'missing-image-prompt', field: 'imagePrompt' });
  if (!safe(scene.motionPrompt) && !safe(scene.visibleAction)) issues.push({ code: 'missing-motion-prompt', field: 'motionPrompt' });
  if (!safe(scene.camera)) issues.push({ code: 'missing-camera-plan', field: 'camera' });
  if (!safe(scene.startState)) issues.push({ code: 'missing-start-state', field: 'startState' });
  if (!safe(scene.endState)) issues.push({ code: 'missing-end-state', field: 'endState' });

  const durationValue = scene.durationSeconds ?? scene.duration;
  if (durationValue !== undefined && durationValue !== null) {
    const duration = Number(durationValue);
    if (!Number.isFinite(duration) || duration < SCENE_DURATION_MIN || duration > SCENE_DURATION_MAX) {
      issues.push({ code: 'invalid-duration', field: 'durationSeconds', min: SCENE_DURATION_MIN, max: SCENE_DURATION_MAX });
    }
  }

  const profileIds = new Set((Array.isArray(characterBible) ? characterBible : [])
    .map(profile => safe(profile?.characterId, 120).toLocaleLowerCase()).filter(Boolean));
  for (const characterId of list(scene.characters)) {
    if (!profileIds.has(characterId.toLocaleLowerCase())) {
      issues.push({ code: 'missing-character-reference', field: 'characters', characterId });
    }
  }

  const speakers = [
    ...(Array.isArray(scene.dialogue) ? scene.dialogue : []),
    ...(Array.isArray(scene.dialogueTimeline) ? scene.dialogueTimeline : [])
  ].map(line => safe(line?.characterId, 120)).filter(Boolean);
  const cast = new Set(list(scene.characters).map(name => name.toLocaleLowerCase()));
  for (const characterId of new Set(speakers)) {
    if (cast.size && !cast.has(characterId.toLocaleLowerCase())) {
      issues.push({ code: 'dialogue-speaker-not-in-scene', field: 'dialogue', characterId });
    }
  }

  return { ready: issues.length === 0, issues };
}

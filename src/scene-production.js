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
    entry.characterId, entry.visualDescription, entry.clothing, entry.colors, entry.distinctiveFeatures
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

/** Creates a motion-only instruction and keeps the still image description separate. */
export function buildMotionGenerationPrompt(scene = {}, characterBible = []) {
  const characterLock = characterDetails(scene, characterBible);
  return [
    safe(scene.motionPrompt) || safe(scene.visibleAction),
    safe(scene.startState) && `Start state: ${safe(scene.startState, 1000)}`,
    safe(scene.endState) && `End state: ${safe(scene.endState, 1000)}`,
    safe(scene.camera) && `Camera movement: ${safe(scene.camera, 1000)}`,
    characterLock.length && `Keep these character designs unchanged: ${characterLock.join(' | ')}`,
    safe(scene.continuityLock) && `Continuity lock: ${safe(scene.continuityLock, 2000)}`,
    safe(scene.negativePrompt) && `Avoid: ${safe(scene.negativePrompt, 2000)}`,
    'Animate only the described action. Preserve the scene composition and character identity; do not introduce new objects or characters.'
  ].filter(Boolean).join('\n\n');
}

export function validateSceneProductionReadiness(scene = {}, characterBible = []) {
  const issues = [];
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
    if (profileIds.size && !profileIds.has(characterId.toLocaleLowerCase())) {
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

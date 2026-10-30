const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const SCENE_INTERACTION_TYPES = Object.freeze([
  'look_at', 'talk_to', 'approach', 'move_away', 'gesture_to',
  'give_object', 'receive_object', 'react_to', 'touch', 'group_action'
]);

/**
 * Normalize one authored interaction event.
 * Times are seconds relative to the beginning of the scene.
 * Character IDs are stable Character Bible IDs, never display-name guesses.
 */
export function normalizeSceneInteraction(input = {}, index = 0, sceneDuration = 3) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const duration = Number.isFinite(Number(sceneDuration)) && Number(sceneDuration) > 0 ? Number(sceneDuration) : 3;
  const typeCandidate = clean(source.type, 40).toLowerCase();
  const type = SCENE_INTERACTION_TYPES.includes(typeCandidate) ? typeCandidate : 'group_action';
  const rawStart = Number(source.startSeconds ?? source.start);
  const rawEnd = Number(source.endSeconds ?? source.end);
  const startSeconds = clamp(Number.isFinite(rawStart) ? rawStart : 0, 0, duration);
  const endSeconds = clamp(Number.isFinite(rawEnd) ? rawEnd : duration, 0, duration);
  const participants = [...new Set((Array.isArray(source.participants) ? source.participants : [])
    .map(id => clean(id, 120)).filter(Boolean))].slice(0, 8);
  return {
    id: clean(source.id, 120) || `interaction_${index + 1}`,
    type,
    participants,
    targetCharacterId: clean(source.targetCharacterId, 120),
    objectId: clean(source.objectId, 120),
    startSeconds: Math.min(startSeconds, endSeconds),
    endSeconds: Math.max(startSeconds, endSeconds),
    description: clean(source.description, 1000)
  };
}

/** Validate references and timing before an interaction is sent to a renderer/provider. */
export function validateSceneInteractions(interactions, sceneCharacters = [], sceneDuration = 3) {
  const events = Array.isArray(interactions) ? interactions : [];
  const known = new Set((Array.isArray(sceneCharacters) ? sceneCharacters : []).map(id => clean(id, 120)).filter(Boolean));
  const duration = Number.isFinite(Number(sceneDuration)) && Number(sceneDuration) > 0 ? Number(sceneDuration) : 3;
  const issues = [];
  const seen = new Set();
  for (const event of events) {
    if (!event || typeof event !== 'object') { issues.push({ code: 'INVALID_EVENT', id: '' }); continue; }
    const id = clean(event.id, 120);
    if (id && seen.has(id)) issues.push({ code: 'DUPLICATE_ID', id });
    if (id) seen.add(id);
    const participants = Array.isArray(event.participants) ? event.participants : [];
    if (['look_at', 'talk_to', 'give_object', 'receive_object', 'touch'].includes(event.type) && participants.length < 2) {
      issues.push({ code: 'MISSING_SECOND_PARTICIPANT', id });
    }
    for (const characterId of participants) {
      if (!known.has(characterId)) issues.push({ code: 'UNKNOWN_CHARACTER', id, characterId });
    }
    const start = Number(event.startSeconds), end = Number(event.endSeconds);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > duration || end <= start) {
      issues.push({ code: 'INVALID_TIMING', id });
    }
    if (event.targetCharacterId && !known.has(event.targetCharacterId)) {
      issues.push({ code: 'UNKNOWN_TARGET', id, characterId: event.targetCharacterId });
    }
  }
  return { valid: issues.length === 0, issues };
}

/** Sample an event's eased activity envelope at a scene-local time in seconds. */
export function sampleInteractionProgress(event, timeSeconds) {
  if (!event || typeof event !== 'object') return 0;
  const start = Number(event.startSeconds), end = Number(event.endSeconds), time = Number(timeSeconds);
  if (![start, end, time].every(Number.isFinite) || end <= start || time <= start || time >= end) return 0;
  const linear = (time - start) / (end - start);
  return linear * linear * (3 - 2 * linear);
}

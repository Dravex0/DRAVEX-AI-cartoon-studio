import { sampleInteractionProgress } from './scene-interactions.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clean = value => String(value ?? '').trim().slice(0, 120);

/**
 * Deterministic screen-space staging for the characters named in one scene.
 * Coordinates are normalized (0..1); interaction times are scene-local seconds.
 */
export function getSceneCharacterLayout(scene = {}, timeSeconds = 0) {
  scene = scene && typeof scene === 'object' && !Array.isArray(scene) ? scene : {};
  const ids = [...new Set((Array.isArray(scene.characters) ? scene.characters : []).map(clean).filter(Boolean))].slice(0, 8);
  if (!ids.length) return [];
  const time = Number.isFinite(Number(timeSeconds)) ? Math.max(0, Number(timeSeconds)) : 0;
  const count = ids.length;
  const spacing = count === 1 ? 0 : Math.min(0.22, 0.64 / (count - 1));
  const center = 0.5;
  const layout = ids.map((id, index) => ({
    characterId: id,
    x: count === 1 ? center : center + (index - (count - 1) / 2) * spacing,
    y: 0.61 + (index % 2) * 0.015,
    facing: index === 0 ? 1 : -1,
    gazeTargetCharacterId: '',
    interaction: ''
  }));
  for (const event of Array.isArray(scene.interactions) ? scene.interactions : []) {
    if (!event || !Array.isArray(event.participants) || !event.participants.length) continue;
    const start = Number(event.startSeconds ?? event.start);
    const end = Number(event.endSeconds ?? event.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || time < start || time > end) continue;
    const participants = event.participants.map(clean).filter(id => ids.includes(id));
    if (!participants.length) continue;
    const progress = sampleInteractionProgress(event, time);
    const first = layout.find(item => item.characterId === participants[0]);
    const second = layout.find(item => item.characterId === participants[1]);
    if (first && second) {
      first.facing = second.x >= first.x ? 1 : -1;
      second.facing = first.x >= second.x ? 1 : -1;
      if (['look_at', 'talk_to', 'gesture_to', 'react_to', 'touch', 'give_object', 'receive_object'].includes(event.type)) {
        first.gazeTargetCharacterId = second.characterId;
        second.gazeTargetCharacterId = first.characterId;
      }
      if (event.type === 'approach' || event.type === 'touch' || event.type === 'give_object' || event.type === 'receive_object') {
        const direction = Math.sign(second.x - first.x) || 1;
        const travel = Math.min(0.12, Math.abs(second.x - first.x) * 0.28) * progress;
        first.x += direction * travel;
        if (event.type === 'approach' || event.type === 'touch') second.x -= direction * travel * 0.25;
      } else if (event.type === 'move_away') {
        const direction = Math.sign(first.x - second.x) || -1;
        first.x += direction * 0.1 * progress;
      }
    }
    for (const id of participants) {
      const actor = layout.find(item => item.characterId === id);
      if (actor) actor.interaction = event.type;
    }
  }
  return layout.map(item => ({ ...item, x: clamp(item.x, 0.12, 0.88) }));
}


/**
 * Returns only explicitly described props in active hand-off events.
 * The first participant is the giver and the second is the receiver.
 */
export function getSceneObjectHandoffs(scene = {}, timeSeconds = 0) {
  scene = scene && typeof scene === 'object' && !Array.isArray(scene) ? scene : {};
  const time = Number.isFinite(Number(timeSeconds)) ? Math.max(0, Number(timeSeconds)) : 0;
  const layout = getSceneCharacterLayout(scene, time);
  const results = [];
  for (const event of Array.isArray(scene.interactions) ? scene.interactions : []) {
    if (!event || !['give_object', 'receive_object'].includes(event.type)) continue;
    const label = String(event.objectDescription ?? event.objectLabel ?? '').trim().slice(0, 120);
    if (!label) continue;
    const start = Number(event.startSeconds ?? event.start);
    const end = Number(event.endSeconds ?? event.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || time < start || time > end) continue;
    const ids = Array.isArray(event.participants) ? event.participants.map(clean) : [];
    const giver = layout.find(item => item.characterId === ids[0]);
    const receiver = layout.find(item => item.characterId === ids[1]);
    if (!giver || !receiver) continue;
    const progress = clamp((time - start) / (end - start), 0, 1);
    const x = giver.x + (receiver.x - giver.x) * progress;
    const y = Math.min(giver.y, receiver.y) - 0.105 - Math.sin(progress * Math.PI) * 0.035;
    results.push({ interactionId: clean(event.id), objectId: clean(event.objectId), label, x, y, progress, giverId: giver.characterId, receiverId: receiver.characterId });
  }
  return results;
}


/**
 * Scene-local arm pose for explicit character interactions.
 * Angles follow the Canvas renderer convention: 0 points down, +90 right.
 */
export function getSceneCharacterGesturePose(scene = {}, timeSeconds = 0, characterId = '') {
  scene = scene && typeof scene === 'object' && !Array.isArray(scene) ? scene : {};
  const id = clean(characterId);
  const pose = { leftArm: 0, rightArm: 0, active: false, interaction: '' };
  const time = Number.isFinite(Number(timeSeconds)) ? Math.max(0, Number(timeSeconds)) : 0;
  const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
  const envelope = (progress, attackStart, attackEnd, releaseStart, releaseEnd) =>
    smooth((progress - attackStart) / (attackEnd - attackStart)) *
    (1 - smooth((progress - releaseStart) / (releaseEnd - releaseStart)));

  for (const event of Array.isArray(scene.interactions) ? scene.interactions : []) {
    if (!event || !Array.isArray(event.participants)) continue;
    const participantIndex = event.participants.map(clean).indexOf(id);
    if (!id || participantIndex < 0) continue;
    const start = Number(event.startSeconds ?? event.start);
    const end = Number(event.endSeconds ?? event.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || time < start || time > end) continue;
    const progress = clamp((time - start) / (end - start), 0, 1);
    let leftArm = 0, rightArm = 0;
    if (['gesture_to', 'give_object', 'receive_object', 'touch'].includes(event.type)) {
      const reach = participantIndex === 0
        ? envelope(progress, 0, 0.32, 0.68, 1)
        : envelope(progress, 0.34, 0.68, 0.82, 1);
      rightArm = 82 * reach;
    } else if (event.type === 'react_to') {
      const reaction = envelope(progress, 0, 0.22, 0.72, 1);
      leftArm = -58 * reaction;
      rightArm = 58 * reaction;
    } else continue;
    if (Math.abs(leftArm) > Math.abs(pose.leftArm)) pose.leftArm = leftArm;
    if (Math.abs(rightArm) > Math.abs(pose.rightArm)) pose.rightArm = rightArm;
    if (Math.abs(leftArm) + Math.abs(rightArm) > 0) {
      pose.active = true;
      pose.interaction = event.type;
    }
  }
  return pose;
}

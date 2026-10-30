const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clean = value => String(value ?? '').trim().slice(0, 120);

/**
 * Deterministic screen-space staging for the characters named in one scene.
 * Coordinates are normalized (0..1); interaction times are scene-local seconds.
 */
export function getSceneCharacterLayout(scene = {}, timeSeconds = 0) {
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
    const progress = clamp((time - start) / (end - start), 0, 1);
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

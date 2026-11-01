const LIMITS = {
  x: [0, 1], y: [0, 1], width: [0.01, 2], height: [0.01, 2],
  rotation: [-Math.PI * 2, Math.PI * 2], scale: [0.05, 4], opacity: [0, 1]
};
const isRecord = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));

function normalizePose(value, required = false) {
  if (!isRecord(value)) return required ? null : {};
  const pose = {};
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const number = value[key];
    if (typeof number !== 'number' || !Number.isFinite(number)) continue;
    pose[key] = Math.max(min, Math.min(max, number));
  }
  return Object.keys(pose).length || !required ? pose : null;
}

/**
 * Upsert one explicit, editor-authored motion phase for a character.
 * This is transform editing, not semantic pose inference from story text.
 */
export function upsertCharacterMotionPhase(timeline, input = {}) {
  const actorId = String(input.actorId ?? '').trim().slice(0, 120);
  const start = input.start;
  const end = input.end;
  if (!actorId) throw new TypeError('A character ID is required.');
  if (typeof start !== 'number' || !Number.isFinite(start)
      || typeof end !== 'number' || !Number.isFinite(end)
      || start < 0 || end > 1 || start >= end) {
    throw new RangeError('Motion timing must satisfy 0 <= start < end <= 1.');
  }
  const from = normalizePose(input.from);
  const to = normalizePose(input.to, true);
  if (!to) throw new TypeError('A target pose needs at least one supported finite transform.');
  const previous = isRecord(timeline) && Array.isArray(timeline.phases) ? timeline.phases : [];
  const phases = previous.filter(phase => isRecord(phase)
    && String(phase.actorId ?? '').trim().toLocaleLowerCase() !== actorId.toLocaleLowerCase());
  if (phases.length >= 8) throw new RangeError('A scene supports motion for at most eight characters.');
  phases.push({
    phase: 'action',
    actorId,
    start,
    end,
    description: 'Motion configured manually in the scene editor.',
    evidence: 'manual-editor',
    motion: { ...(Object.keys(from).length ? { from } : {}), to }
  });
  phases.sort((a, b) => a.start - b.start || a.actorId.localeCompare(b.actorId));
  return { schemaVersion: 1, phases };
}

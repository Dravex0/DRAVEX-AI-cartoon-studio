const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clean = value => String(value ?? '').trim();
function point(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Number.isFinite(value.x) && value.x >= 0 && value.x <= 1
    && Number.isFinite(value.y) && value.y >= 0 && value.y <= 1
    ? { x: value.x, y: value.y } : null;
}
/** Convert authored viewport trajectories for grounded physics events into render samples.
 * Physics world coordinates (meters) are never treated as viewport coordinates. */
export function buildGroundedPhysicsVisualPlan(scene = {}, physicsModel = null, progress = 1) {
  const p = clamp(Number.isFinite(progress) ? progress : 1, 0, 1);
  const source = new Map((Array.isArray(scene?.physicsEvents) ? scene.physicsEvents : [])
    .filter(event => event && typeof event === 'object' && !Array.isArray(event))
    .map(event => [clean(event.id), event]).filter(([id]) => id));
  const grounded = Array.isArray(physicsModel?.events) ? physicsModel.events : [];
  const result = [];
  for (const event of grounded) {
    if (!event || event.grounded !== true || !['motion', 'throw', 'fall', 'collision', 'push', 'pull'].includes(event.type)) continue;
    const authored = source.get(clean(event.id));
    if (!authored || clean(authored.entityId) !== clean(event.entityId)) continue;
    const from = point(authored.visualStartPosition), to = point(authored.visualEndPosition);
    const start = authored.visualStartProgress, end = authored.visualEndProgress;
    if (!from || !to || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > 1 || start >= end) continue;
    const t = clamp((p - start) / (end - start), 0, 1), eased = t * t * (3 - 2 * t);
    result.push({ id: clean(event.entityId), eventId: clean(event.id), eventType: event.type,
      x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased,
      active: p >= start && p <= end, progress: t, evidence: clean(event.evidence) });
  }
  return result;
}

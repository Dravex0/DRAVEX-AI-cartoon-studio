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
  // Event IDs are join keys between authored visual paths and grounded physics.
  // Reject duplicate keys instead of silently letting the last event win.
  const authoredEvents = (Array.isArray(scene?.physicsEvents) ? scene.physicsEvents : [])
    .filter(event => event && typeof event === 'object' && !Array.isArray(event));
  const authoredCounts = new Map();
  for (const event of authoredEvents) {
    const id = clean(event.id);
    if (id) authoredCounts.set(id, (authoredCounts.get(id) || 0) + 1);
  }
  const source = new Map(authoredEvents
    .filter(event => clean(event.id) && authoredCounts.get(clean(event.id)) === 1)
    .map(event => [clean(event.id), event]));
  const grounded = Array.isArray(physicsModel?.events) ? physicsModel.events : [];
  const groundedCounts = new Map();
  for (const event of grounded) {
    const id = clean(event?.id);
    if (id) groundedCounts.set(id, (groundedCounts.get(id) || 0) + 1);
  }
  const result = [];
  for (const event of grounded) {
    if (!event || event.grounded !== true || !['motion', 'throw', 'fall', 'collision', 'push', 'pull'].includes(event.type)) continue;
    const eventId = clean(event.id);
    if (!eventId || groundedCounts.get(eventId) !== 1) continue;
    const authored = source.get(eventId);
    if (!authored || clean(authored.entityId) !== clean(event.entityId)) continue;
    const from = point(authored.visualStartPosition), to = point(authored.visualEndPosition);
    const start = authored.visualStartProgress, end = authored.visualEndProgress;
    if (!from || !to || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > 1 || start >= end) continue;
    const t = clamp((p - start) / (end - start), 0, 1);
    const eased = t * t * (3 - 2 * t);
    const control = point(authored.visualControlPoint);
    const linear = { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
    const position = control ? {
      x: (1 - eased) ** 2 * from.x + 2 * (1 - eased) * eased * control.x + eased ** 2 * to.x,
      y: (1 - eased) ** 2 * from.y + 2 * (1 - eased) * eased * control.y + eased ** 2 * to.y
    } : linear;
    const hasRotation = Number.isFinite(authored.visualStartRotation) && Number.isFinite(authored.visualEndRotation);
    result.push({ id: clean(event.entityId), eventId: clean(event.id), eventType: event.type,
      x: position.x, y: position.y,
      ...(hasRotation ? { rotation: authored.visualStartRotation
        + (authored.visualEndRotation - authored.visualStartRotation) * eased } : {}),
      active: p >= start && p <= end, progress: t, evidence: clean(event.evidence) });
  }
  return result;
}

/**
 * Source-grounded causal interaction model.
 * Connects explicitly declared actions, effects, reactions and physical events.
 * No edge is inferred from scene adjacency or plausible real-world behavior.
 */
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const TYPES = new Set(['action', 'effect', 'reaction', 'object_state_change', 'physical_event']);

function sourceHas(scene, evidence) {
  if (!evidence) return false;
  const text = [scene.storyDetail, scene.visibleAction]
    .filter(value => typeof value === 'string').join('\n');
  if (text.includes(evidence)) return true;
  return (Array.isArray(scene.sourceEvents) ? scene.sourceEvents : []).some(item =>
    typeof item === 'string' ? item.includes(evidence)
      : record(item) && ['evidence', 'text', 'description']
        .some(key => typeof item[key] === 'string' && item[key].includes(evidence)));
}

/**
 * Scene metadata contract:
 * causalEvents: [{id,type,entityId,actorId,targetId,evidence,causedByEventId,physicsEventId}]
 */
export function buildSceneCausalModel(scenes = [], worldModel = null, physicsModel = null) {
  const list = Array.isArray(scenes) ? scenes.filter(record) : [];
  const sceneIds = list.map((scene, index) => clean(scene.id, 120) || `scene_${index + 1}`);
  const counts = new Map();
  sceneIds.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
  const sceneOrder = new Map(sceneIds.map((id, index) => [id, index]));
  const worldIds = new Set((Array.isArray(worldModel?.entities) ? worldModel.entities : [])
    .filter(record).map(entity => clean(entity.id, 160)).filter(Boolean));
  const physicsIds = new Set((Array.isArray(physicsModel?.events) ? physicsModel.events : [])
    .filter(record).map(event => clean(event.id, 160)).filter(Boolean));
  const events = [];
  const issues = [];
  const eventCounts = new Map();

  list.forEach((scene, index) => {
    const sceneId = sceneIds[index];
    const declared = Array.isArray(scene.causalEvents) ? scene.causalEvents : [];
    declared.forEach((raw, eventIndex) => {
      if (!record(raw)) {
        issues.push({ code: 'malformed-causal-event', severity: 'warning', sceneId, eventIndex });
        return;
      }
      const id = clean(raw.id, 160) || `${sceneId}_causal_${eventIndex + 1}`;
      eventCounts.set(id, (eventCounts.get(id) || 0) + 1);
      const evidence = clean(raw.evidence, 500);
      const type = clean(raw.type, 40).toLocaleLowerCase();
      const entityId = clean(raw.entityId, 160) || null;
      const actorId = clean(raw.actorId, 160) || null;
      const targetId = clean(raw.targetId, 160) || null;
      const causedByEventId = clean(raw.causedByEventId, 160) || null;
      const physicsEventId = clean(raw.physicsEventId, 160) || null;
      const grounded = sourceHas(scene, evidence);
      const event = { id, sceneId, sequence: events.length + 1, type, entityId,
        actorId, targetId, evidence: evidence || null, grounded,
        causedByEventId, physicsEventId };
      events.push(event);
      if (!TYPES.has(type)) issues.push({ code: 'unsupported-causal-event-type', severity: 'warning', sceneId, eventId: id });
      if (!grounded) issues.push({ code: 'causal-event-source-unverified', severity: 'warning', sceneId, eventId: id });
      if ((actorId || targetId || entityId) && worldIds.size) {
        for (const [role, value] of [['actor', actorId], ['target', targetId], ['entity', entityId]]) {
          if (value && !worldIds.has(value)) issues.push({ code: 'causal-event-entity-unresolved', severity: 'warning', sceneId, eventId: id, role, entityId: value });
        }
      }
      if (physicsEventId && !physicsIds.has(physicsEventId)) {
        issues.push({ code: 'causal-physics-event-unresolved', severity: 'warning', sceneId, eventId: id, physicsEventId });
      }
    });
  });

  const byId = new Map(events.map(event => [event.id, event]));
  const edges = [];
  for (const event of events) {
    if (!event.causedByEventId) continue;
    const cause = byId.get(event.causedByEventId);
    const valid = event.grounded && cause && eventCounts.get(event.causedByEventId) === 1
      && eventCounts.get(event.id) === 1 && cause.grounded
      && cause.sequence < event.sequence
      && sceneOrder.get(cause.sceneId) <= sceneOrder.get(event.sceneId)
      && counts.get(cause.sceneId) === 1 && counts.get(event.sceneId) === 1;
    if (!valid) {
      issues.push({ code: 'causal-edge-unresolved-or-invalid', severity: 'warning',
        sceneId: event.sceneId, eventId: event.id, causedByEventId: event.causedByEventId });
      continue;
    }
    edges.push({ type: 'causes', fromEventId: cause.id, toEventId: event.id,
      fromSceneId: cause.sceneId, toSceneId: event.sceneId,
      evidence: event.evidence, causeEvidence: cause.evidence });
  }

  const incoming = new Set(edges.map(edge => edge.toEventId));
  const outgoing = new Map();
  for (const edge of edges) {
    if (!outgoing.has(edge.fromEventId)) outgoing.set(edge.fromEventId, []);
    outgoing.get(edge.fromEventId).push(edge.toEventId);
  }
  const chains = [];
  for (const event of events) {
    if (incoming.has(event.id)) continue;
    const path = [];
    const visited = new Set();
    let current = event;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.push(current.id);
      const next = outgoing.get(current.id) || [];
      current = next.length === 1 ? byId.get(next[0]) : null;
    }
    if (path.length) chains.push({ id: `causal_chain_${chains.length + 1}`, eventIds: path });
  }

  return {
    schemaVersion: 1,
    eventCount: events.length,
    linkedEventCount: edges.length,
    events,
    edges,
    chains,
    validation: { passed: !issues.some(issue => issue.severity === 'error'), issues },
    constraints: [
      'Only explicitly declared causalEvents are represented; scene adjacency never creates a causal edge.',
      'Every event requires exact evidence present in its own scene source text or sourceEvents.',
      'A causal edge requires a unique, earlier, grounded event and unique scene identities.',
      'Actor, target, entity and physics references are checked when corresponding models contain known IDs.',
      'Missing causes, effects, identities and physical facts remain unresolved rather than guessed.'
    ]
  };
}

import { buildScenePhysicsModel } from './scene-physics-model.js';

const clean = value => String(value ?? '').trim().slice(0, 180);
const key = value => clean(value).toLocaleLowerCase();
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

const STATE_PROPERTIES = new Set(['holder', 'position', 'rotation', 'scale', 'visibility', 'visible', 'open', 'doorState', 'location', 'status', 'condition', 'support']);

const INTERACTION_RULES = Object.freeze({
  collision: 'Both bodies must meet at the same contact point; preserve the reaction and separate or rebound only when the source describes it.',
  contact: 'Keep the named bodies in continuous contact for the authored interval; do not create contact when contact is unknown.',
  support: 'Keep the supported entity resting on the named support surface; preserve gravity direction and stable footing.',
  grasp: 'Move the actor hand to the named object, establish contact, close the grip, and keep the object attached to that hand while held.',
  carry: 'Maintain the established holder-to-object attachment; the object follows the actor without sliding, teleporting, or changing hands.',
  release: 'Break the holder attachment at the release moment; the object continues from its last position and velocity.',
  throw: 'Build anticipation, release the object from the actor, then move it independently along the authored path toward the named target.',
  catch: 'Move the catcher toward the incoming object, establish contact, absorb its motion, and attach it to the catcher only after the catch.',
  push: 'Keep the actor in contact with the object while force is applied; the object moves away from the contact side.',
  pull: 'Keep the actor connected to the object while pulling; the object follows the actor toward the pull direction.',
  transfer: 'Animate a continuous handoff: the previous holder releases only as the next holder takes possession; never duplicate the object.'
});

function sourceHasEvidence(scene, evidence) {
  if (!evidence) return false;
  const story = [scene.storyDetail, scene.visibleAction]
    .filter(value => typeof value === 'string').join('\n');
  if (story.includes(evidence)) return true;
  return (Array.isArray(scene.sourceEvents) ? scene.sourceEvents : []).some(item =>
    typeof item === 'string' ? item.includes(evidence)
      : isRecord(item) && ['evidence', 'text', 'description'].some(field =>
        typeof item[field] === 'string' && item[field].includes(evidence))
  );
}

/**
 * Build a source-grounded interaction graph for characters, props and surfaces.
 * It describes how entities affect one another; it does not fabricate positions,
 * contact, velocities, mass, or unmentioned participants.
 */
export function buildSceneInteractionModel(scene = {}) {
  const physics = buildScenePhysicsModel([scene]);
  const rawEvents = Array.isArray(scene.physicsEvents) ? scene.physicsEvents : [];
  const events = [];
  const stateTransitions = [];
  const entities = new Map();

  const addEntity = (id, role) => {
    const value = clean(id);
    if (!value) return;
    const entityKey = key(value);
    const current = entities.get(entityKey) || { id: value, roles: [] };
    if (!current.roles.includes(role)) current.roles.push(role);
    entities.set(entityKey, current);
  };

  for (const event of physics.events) {
    if (!event.grounded || !INTERACTION_RULES[event.type]) continue;
    const raw = rawEvents.find(item => isRecord(item) && (
      (item.id && clean(item.id) === event.id)
      || (!item.id && clean(item.type).toLocaleLowerCase() === event.type
        && clean(item.evidence) === event.evidence && clean(item.entityId) === event.entityId)
    ));
    if (!raw || !sourceHasEvidence(scene, event.evidence)) continue;

    addEntity(event.entityId, 'entity');
    addEntity(event.actorId, 'actor');
    addEntity(event.otherEntityId, 'other-body');
    addEntity(event.supportEntityId, 'support-surface');
    addEntity(event.targetId, 'target');
    addEntity(event.fromEntityId, 'previous-holder');
    addEntity(event.toEntityId, 'next-holder');

    const participants = [...new Set([
      event.actorId, event.entityId, event.otherEntityId, event.supportEntityId,
      event.targetId, event.fromEntityId, event.toEntityId
    ].filter(Boolean))];
    const start = Number(raw.start);
    const end = Number(raw.end);
    events.push({
      id: event.id,
      type: event.type,
      entityId: event.entityId,
      actorId: event.actorId,
      targetId: event.targetId,
      otherEntityId: event.otherEntityId,
      supportEntityId: event.supportEntityId,
      fromEntityId: event.fromEntityId,
      toEntityId: event.toEntityId,
      participants,
      contact: event.contactKnown ? event.contact : null,
      grounded: true,
      evidence: event.evidence,
      ...(Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end <= 1 && start < end
        ? { start, end } : {}),
      rule: INTERACTION_RULES[event.type]
    });
  }

  const rawStateChanges = Array.isArray(scene.stateChanges) ? scene.stateChanges : [];
  for (const [index, change] of rawStateChanges.entries()) {
    if (!isRecord(change)) continue;
    const property = clean(change.property, 60);
    const evidence = clean(change.evidence, 500);
    const entityId = clean(change.entityId);
    if (!entityId || !STATE_PROPERTIES.has(property) || !sourceHasEvidence(scene, evidence)) continue;
    addEntity(entityId, change.entityType === 'character' ? 'actor' : 'prop-or-world-entity');
    if (change.value && typeof change.value === 'string') addEntity(change.value, property === 'holder' ? 'holder' : 'related-entity');
    stateTransitions.push({
      id: clean(change.id) || `state_${index + 1}`,
      entityId,
      entityType: clean(change.entityType, 40) || 'unknown',
      property,
      previousValue: change.previousValue ?? null,
      value: change.value ?? null,
      actionIntent: clean(change.actionIntent, 80) || null,
      position: isRecord(change.position) && Number.isFinite(change.position.x) && Number.isFinite(change.position.y)
        ? { x: change.position.x, y: change.position.y } : null,
      evidence
    });
  }

  const holderTimeline = physics.holderTimeline
    .filter(item => events.some(event => event.id === item.eventId));

  return {
    schemaVersion: 1,
    status: events.length || stateTransitions.length ? 'grounded-interactions' : 'no-grounded-interactions',
    entityCount: entities.size,
    eventCount: events.length,
    stateTransitionCount: stateTransitions.length,
    entities: [...entities.values()],
    events,
    stateTransitions,
    holderTimeline,
    validationIssues: physics.validation.issues.filter(issue =>
      issue.severity !== 'info' && (issue.code.includes('holder') || issue.code.includes('participant')
        || issue.code.includes('contact') || issue.code.includes('collision') || issue.code.includes('support'))
    )
  };
}

/** Convert the grounded interaction graph into concise provider-neutral motion rules. */
export function formatSceneInteractionInstructions(model) {
  if (!isRecord(model) || !Array.isArray(model.events) || !Array.isArray(model.stateTransitions)
      || (!model.events.length && !model.stateTransitions.length)) return '';
  const lines = model.events.map((event, index) => {
    const interval = Number.isFinite(event.start) && Number.isFinite(event.end)
      ? ` [${Math.round(event.start * 100)}%-${Math.round(event.end * 100)}%]` : '';
    const participants = event.participants.join(' ↔ ');
    const contact = event.contact === true ? ' Contact is explicitly required.'
      : event.contact === false ? ' No physical contact is specified.' : ' Contact state is unknown; do not assume it.';
    return `${index + 1}. ${event.type}${interval}: ${participants}. ${event.rule}${contact} Evidence: ${event.evidence}`;
  });
  const stateLines = model.stateTransitions.map((change, index) =>
    `State ${index + 1}. ${change.entityId}.${change.property}: ${JSON.stringify(change.previousValue)} → ${JSON.stringify(change.value)}${change.actionIntent ? `; action: ${change.actionIntent}` : ''}${change.position ? `; position: (${change.position.x}, ${change.position.y})` : ''}. Evidence: ${change.evidence}`
  );
  return [
    'Grounded entity-interaction graph (only these interactions and state changes are established by source evidence):',
    ...lines,
    ...stateLines,
    'Interaction continuity: one physical object has one location and at most one holder at a time. Preserve identity, ownership, contact and momentum across frames. A handoff must not duplicate the object. Collisions require both named bodies. Unsupported or ambiguous interactions must remain unresolved rather than be invented.'
  ].join('\n');
}

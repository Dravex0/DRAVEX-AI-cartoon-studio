/**
 * Universal, source-grounded world model for animation scenes.
 * Entity kinds are descriptive metadata, never a whitelist of allowed subjects:
 * humans, animals, robots, vehicles, props and newly introduced entity kinds
 * can all participate through the same IDs and relation model.
 */
const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const keyOf = value => clean(value, 160).toLocaleLowerCase();

function addEntity(map, id, kind, sceneId, attributes = {}) {
  const name = clean(id, 160);
  if (!name) return;
  const key = keyOf(name);
  const current = map.get(key) || { id: name, kind: kind || 'entity', scenes: [], attributes: {} };
  if (kind && current.kind === 'entity') current.kind = kind;
  if (sceneId && !current.scenes.includes(sceneId)) current.scenes.push(sceneId);
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null && value !== '') current.attributes[key] = value;
  }
  map.set(key, current);
}

/**
 * Converts existing scene facts into a reusable entity/relation graph.
 * It deliberately does not guess missing participants, object identities,
 * transfers, or physical outcomes from vague prose.
 */
export function buildSceneWorldModel(scenes = []) {
  const list = Array.isArray(scenes) ? scenes : [];
  const entities = new Map();
  const relations = [];
  const events = [];
  const state = new Map();

  list.forEach((scene, index) => {
    if (!record(scene)) return;
    const sceneId = clean(scene.id, 120) || `scene_${index + 1}`;
    const participants = Array.isArray(scene.characters) ? scene.characters : [];
    for (const participant of participants) {
      const id = clean(participant, 160);
      // Character identity is deliberately neutral: no fox/person-specific branch.
      addEntity(entities, id, 'character', sceneId);
    }
    const location = clean(scene.location || scene.environmentDescription, 500);
    if (location) addEntity(entities, location, 'location', sceneId);

    const sceneEvents = [];
    const addRelation = relation => {
      if (!relation.from || !relation.to || !relation.type) return;
      relations.push({ sceneId, ...relation });
    };

    for (const interaction of (Array.isArray(scene.interactions) ? scene.interactions : [scene.interaction]).filter(record)) {
      const actor = clean(interaction.actorId, 160);
      const target = clean(interaction.targetId, 160);
      if (!actor || !target) continue;
      addEntity(entities, actor, 'character', sceneId);
      addEntity(entities, target, 'character', sceneId);
      const evidence = clean(interaction.evidence, 500);
      const event = { type: clean(interaction.type, 80) || 'interact', actorId: actor, targetId: target, evidence };
      sceneEvents.push(event);
      addRelation({ type: 'acts_on', from: actor, to: target, action: event.type, evidence });
    }

    const changes = Array.isArray(scene.stateChanges) ? scene.stateChanges : [];
    for (const change of changes.filter(record)) {
      const entityId = clean(change.entityId, 160);
      const entityKind = clean(change.entityType, 40) || 'object';
      const actorId = clean(change.actorId, 160);
      if (!entityId) continue;
      addEntity(entities, entityId, entityKind, sceneId);
      if (actorId) {
        addEntity(entities, actorId, 'character', sceneId);
        addRelation({ type: 'changes_state_of', from: actorId, to: entityId,
          property: clean(change.property, 60), previousValue: change.previousValue ?? null,
          value: change.value ?? null, actionIntent: clean(change.actionIntent, 60),
          evidence: clean(change.evidence, 500) });
      }
      const propertyKey = entityKind + ':' + keyOf(entityId) + ':' + clean(change.property, 60);
      const previous = state.has(propertyKey) ? state.get(propertyKey) : null;
      const declaredPrevious = change.previousValue ?? null;
      const continuity = !state.has(propertyKey) || declaredPrevious === previous;
      if (change.value !== undefined) state.set(propertyKey, change.value);
      if (!continuity) sceneEvents.push({ type: 'state_continuity_conflict', entityId, property: change.property,
        expectedPreviousValue: previous, declaredPreviousValue: declaredPrevious });
    }

    const timeline = scene.actionTimeline;
    for (const phase of (Array.isArray(timeline?.phases) ? timeline.phases : [])) {
      if (!record(phase)) continue;
      const actor = clean(phase.actorId, 160);
      const target = clean(phase.targetId, 160);
      if (actor) addEntity(entities, actor, 'character', sceneId);
      if (target) addEntity(entities, target, 'character', sceneId);
      const event = { type: clean(phase.phase, 40) || 'action', actorId: actor || null,
        targetId: target || null, start: phase.start ?? null, end: phase.end ?? null,
        description: clean(phase.description, 700), evidence: clean(phase.evidence, 500) };
      sceneEvents.push(event);
      if (actor && target) addRelation({ type: 'acts_on', from: actor, to: target,
        action: event.type, evidence: event.evidence });
      for (const step of (Array.isArray(phase.steps) ? phase.steps : [])) {
        if (!record(step)) continue;
        const stepActor = clean(step.actorId || actor, 160);
        const stepTarget = clean(step.targetId, 160);
        if (stepActor) addEntity(entities, stepActor, 'character', sceneId);
        if (stepTarget) addEntity(entities, stepTarget, 'character', sceneId);
        sceneEvents.push({ type: clean(step.intent, 80) || 'action', actorId: stepActor || null,
          targetId: stepTarget || null, start: step.start ?? null, end: step.end ?? null,
          description: clean(step.description, 500), evidence: clean(step.evidence, 300) });
        if (stepActor && stepTarget) addRelation({ type: 'acts_on', from: stepActor, to: stepTarget,
          action: clean(step.intent, 80), evidence: clean(step.evidence, 300) });
      }
    }

    events.push({ id: `event_${index + 1}`, sceneId, sequence: index + 1,
      sourceEvidence: clean(scene.storyDetail, 1200), participants: participants.map(value => clean(value, 160)).filter(Boolean),
      location: location || null, actions: sceneEvents });
  });

  return { schemaVersion: 1, entityCount: entities.size, relationCount: relations.length,
    entities: [...entities.values()], relations, events,
    validation: { stateContinuityConflicts: events.flatMap(event => event.actions
      .filter(action => action.type === 'state_continuity_conflict')) },
    principles: ['Entity identities are independent of species or character archetype.',
      'Relations preserve actor-to-target direction.',
      'Only explicit structured facts become world-model relations; ambiguous facts remain unresolved.'] };
}

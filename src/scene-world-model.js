/**
 * Universal, source-grounded world model for animation scenes.
 * Entity kinds are descriptive metadata, never a whitelist of allowed subjects:
 * humans, animals, robots, vehicles, props and newly introduced entity kinds
 * can all participate through the same IDs and relation model.
 */
import { inferCharacterInteractions } from './character-interaction.js';
import { validateCharacterActionTimeline } from './character-action-timeline.js';

const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const keyOf = value => clean(value, 160).toLocaleLowerCase();

function sourceHasEvidence(scene, evidence, sourceText = '') {
  if (!evidence) return false;
  if (sourceText.includes(evidence)) return true;
  return (Array.isArray(scene.sourceEvents) ? scene.sourceEvents : []).some(item =>
    typeof item === 'string' ? item.includes(evidence)
      : record(item) && ['evidence', 'text', 'description'].some(field =>
        typeof item[field] === 'string' && item[field].includes(evidence))
  );
}

function evidenceNamesEntity(evidence, entityId) {
  const name = keyOf(entityId);
  return Boolean(name && keyOf(evidence).includes(name));
}

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
function resolveSceneLanguage(scene, fallback = 'en') {
  const requested = clean(scene?.language || scene?.lang || fallback, 40).toLocaleLowerCase();
  if (/^(ru|russian|рус)/u.test(requested)) return 'ru';
  if (/^(uk|ua|ukrainian|укра)/u.test(requested)) return 'uk';
  if (/^(es|spanish|español|исп)/u.test(requested)) return 'es';
  if (/^(en|english|англ)/u.test(requested)) return 'en';
  const text = clean(scene?.storyDetail || scene?.visibleAction, 1200);
  if (/[іїєґ]/iu.test(text)) return 'uk';
  if (/[а-яё]/iu.test(text)) return 'ru';
  if (/\b(?:el|la|los|las|una|uno|un|por|para|con|ayuda|entrega)\b/iu.test(text)) return 'es';
  return 'en';
}

export function buildSceneWorldModel(scenes = [], options = {}) {
  const fallbackLanguage = clean(options?.language, 40) || 'en';
  const list = Array.isArray(scenes) ? scenes : [];
  const entities = new Map();
  const relations = [];
  const events = [];
  const state = new Map();

  list.forEach((scene, index) => {
    if (!record(scene)) {
      // Keep a positional placeholder so later scene/event indexes never shift
      // when an upstream planner emits a malformed entry.
      events.push({ id: `event_${index + 1}`, sceneId: `scene_${index + 1}`,
        sequence: index + 1, sourceEvidence: '', participants: [], location: null,
        actions: [], invalidInput: true });
      return;
    }
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
      const duplicate = relations.some(item => item.sceneId === sceneId && item.type === relation.type
        && item.from === relation.from && item.to === relation.to
        && item.action === relation.action && item.property === relation.property);
      if (!duplicate) relations.push({ sceneId, ...relation });
    };

    const explicitInteractions = (Array.isArray(scene.interactions) ? scene.interactions : [scene.interaction]).filter(record);
    const sourceText = [scene.storyDetail, scene.visibleAction].filter(value => typeof value === 'string').map(value => clean(value, 1200)).filter(Boolean).join('\n');
    const language = resolveSceneLanguage(scene, fallbackLanguage);
    const inferredInteractions = sourceText
      ? inferCharacterInteractions(sourceText, participants, language)
      : [];
    const interactionKeys = new Set();
    for (const interaction of [...explicitInteractions, ...inferredInteractions]) {
      const interactionKey = [interaction.type, interaction.actorId, interaction.targetId].map(keyOf).join(':');
      if (interactionKeys.has(interactionKey)) continue;
      interactionKeys.add(interactionKey);
      const actor = clean(interaction.actorId, 160);
      const target = clean(interaction.targetId, 160);
      const evidence = clean(interaction.evidence, 500);
      if (!actor || !target || !sourceHasEvidence(scene, evidence, sourceText)
          || !evidenceNamesEntity(evidence, actor) || !evidenceNamesEntity(evidence, target)) continue;
      addEntity(entities, actor, 'character', sceneId);
      addEntity(entities, target, 'character', sceneId);
      const event = { type: clean(interaction.type, 80) || 'interact', actorId: actor, targetId: target, evidence };
      sceneEvents.push(event);
      addRelation({ type: 'acts_on', from: actor, to: target, action: event.type, evidence });
    }

    const changes = Array.isArray(scene.stateChanges) ? scene.stateChanges : [];
    const participantKeys = new Set(participants.map(keyOf));
    const propKeys = new Set(changes.filter(record).filter(change => clean(change.entityType, 40) === 'prop')
      .map(change => keyOf(change.entityId)).filter(Boolean));
    const addActionTarget = targetId => {
      const target = clean(targetId, 160);
      if (!target) return;
      const kind = propKeys.has(keyOf(target)) ? 'prop'
        : participantKeys.has(keyOf(target)) ? 'character' : 'entity';
      addEntity(entities, target, kind, sceneId);
    };
    for (const change of changes.filter(record)) {
      const entityId = clean(change.entityId, 160);
      const entityKind = clean(change.entityType, 40) || 'object';
      const actorId = clean(change.actorId, 160);
      const evidence = clean(change.evidence, 500);
      if (!entityId || !sourceHasEvidence(scene, evidence, sourceText)) continue;
      addEntity(entities, entityId, entityKind, sceneId);
      if (actorId) {
        addEntity(entities, actorId, 'character', sceneId);
        addRelation({ type: 'changes_state_of', from: actorId, to: entityId,
          property: clean(change.property, 60), previousValue: change.previousValue ?? null,
          value: change.value ?? null, actionIntent: clean(change.actionIntent, 60),
          evidence });
      }
      const propertyKey = entityKind + ':' + keyOf(entityId) + ':' + clean(change.property, 60);
      const previous = state.has(propertyKey) ? state.get(propertyKey) : null;
      const declaredPrevious = change.previousValue ?? null;
      const continuity = !state.has(propertyKey) || declaredPrevious === previous;
      if (change.value !== undefined) state.set(propertyKey, change.value);
      if (!continuity) sceneEvents.push({ type: 'state_continuity_conflict', entityId, property: change.property,
        expectedPreviousValue: previous, declaredPreviousValue: declaredPrevious });
    }

    // Persistent snapshots keep the same prop identity and known state alive
    // across scene cuts, even when the next scene contains no new state delta.
    const snapshots = Array.isArray(scene.stateSnapshot) ? scene.stateSnapshot : [];
    for (const snapshot of snapshots.filter(record)) {
      const entityId = clean(snapshot.entityId, 160);
      const entityKind = clean(snapshot.entityType, 40) || 'entity';
      const property = clean(snapshot.property, 60);
      if (!entityId || !property || snapshot.snapshot !== true) continue;
      const stateKey = entityKind + ':' + keyOf(entityId) + ':' + property;
      const value = snapshot.value ?? null;
      if (!state.has(stateKey)) continue;
      if (state.get(stateKey) !== value) {
        sceneEvents.push({ type: 'state_snapshot_conflict', entityId, property,
          currentValue: state.get(stateKey), snapshotValue: value });
        continue;
      }
      addEntity(entities, entityId, entityKind, sceneId);
      sceneEvents.push({ type: 'state_snapshot', entityId, property, value,
        evidence: clean(snapshot.evidence, 500) });
    }

    // Add physical relations only when the event's exact evidence is present
    // in this scene. Unverified event metadata never enters the world graph.
    const rawPhysicsEvents = Array.isArray(scene.physicsEvents) ? scene.physicsEvents : [];
    for (const physical of rawPhysicsEvents.filter(record)) {
      const evidence = clean(physical.evidence, 500);
      const evidenceGrounded = Boolean(evidence && (
        sourceText.includes(evidence)
        || (Array.isArray(scene.sourceEvents) ? scene.sourceEvents : []).some(item =>
          typeof item === 'string' ? item.includes(evidence)
            : record(item) && ['evidence', 'text', 'description'].some(field =>
              typeof item[field] === 'string' && item[field].includes(evidence)))
      ));
      if (!evidenceGrounded) continue;
      const type = clean(physical.type, 40).toLocaleLowerCase();
      const entityId = clean(physical.entityId, 160);
      const actorId = clean(physical.actorId, 160);
      const targetId = clean(physical.targetId, 160);
      const otherEntityId = clean(physical.otherEntityId, 160);
      const supportEntityId = clean(physical.supportEntityId, 160);
      const fromEntityId = clean(physical.fromEntityId, 160);
      const toEntityId = clean(physical.toEntityId, 160);
      const entityKind = entityId && participantKeys.has(keyOf(entityId)) ? 'character' : 'prop';
      if (entityId) addEntity(entities, entityId, entityKind, sceneId);
      if (actorId) addEntity(entities, actorId, 'character', sceneId);
      if (targetId) addActionTarget(targetId);
      if (otherEntityId) addEntity(entities, otherEntityId,
        participantKeys.has(keyOf(otherEntityId)) ? 'character' : 'entity', sceneId);
      if (supportEntityId) addEntity(entities, supportEntityId, 'surface', sceneId);
      if (fromEntityId) addEntity(entities, fromEntityId, 'character', sceneId);
      if (toEntityId) addEntity(entities, toEntityId, 'character', sceneId);
      const event = { type: 'physics_' + (type || 'event'), actorId: actorId || null,
        entityId: entityId || null, targetId: targetId || null,
        otherEntityId: otherEntityId || null, supportEntityId: supportEntityId || null,
        fromEntityId: fromEntityId || null, toEntityId: toEntityId || null, evidence };
      sceneEvents.push(event);
      if (actorId && entityId) addRelation({ type: 'physical_action', from: actorId, to: entityId, action: type, evidence });
      if (entityId && otherEntityId) addRelation({ type: 'physical_contact', from: entityId, to: otherEntityId, action: type, evidence });
      if (entityId && supportEntityId) addRelation({ type: 'supported_by', from: entityId, to: supportEntityId, action: type, evidence });
      if (fromEntityId && toEntityId && entityId) {
        addRelation({ type: 'transfers_ownership', from: fromEntityId, to: toEntityId,
          action: type, property: 'holder', value: entityId, evidence });
      }
    }

    const timeline = scene.actionTimeline;
    const timelineReport = validateCharacterActionTimeline(scene);
    for (const phase of (timelineReport.passed && Array.isArray(timeline?.phases) ? timeline.phases : [])) {
      if (!record(phase)) continue;
      const actor = clean(phase.actorId, 160);
      const target = clean(phase.targetId, 160);
      const evidence = clean(phase.evidence, 500);
      const groundedTarget = target && evidenceNamesEntity(evidence, target) ? target : '';
      if (actor) addEntity(entities, actor, 'character', sceneId);
      if (groundedTarget) addActionTarget(groundedTarget);
      const event = { type: clean(phase.phase, 40) || 'action', actorId: actor || null,
        targetId: groundedTarget || null, start: phase.start ?? null, end: phase.end ?? null,
        description: clean(phase.description, 700), evidence };
      sceneEvents.push(event);
      if (actor && target && evidenceNamesEntity(event.evidence, actor)
          && evidenceNamesEntity(event.evidence, target)) {
        addRelation({ type: 'acts_on', from: actor, to: target,
          action: event.type, evidence: event.evidence });
      }
      for (const step of (Array.isArray(phase.steps) ? phase.steps : [])) {
        if (!record(step)) continue;
        const stepActor = clean(step.actorId || actor, 160);
        const stepTarget = clean(step.targetId, 160);
        if (stepActor) addEntity(entities, stepActor, 'character', sceneId);
        if (stepTarget) addActionTarget(stepTarget);
        sceneEvents.push({ type: clean(step.intent, 80) || 'action', actorId: stepActor || null,
          targetId: stepTarget || null, start: step.start ?? null, end: step.end ?? null,
          description: clean(step.description, 500), evidence: clean(step.evidence, 300) });
        if (stepActor && stepTarget) addRelation({ type: 'acts_on', from: stepActor, to: stepTarget,
          action: clean(step.intent, 80), evidence: clean(step.evidence, 300) });
      }
    }

    events.push({ id: `event_${index + 1}`, sceneId, sequence: index + 1,
      sourceEvidence: sourceText, participants: participants.map(value => clean(value, 160)).filter(Boolean),
      location: location || null, actions: sceneEvents });
  });

  return { schemaVersion: 1, entityCount: entities.size, relationCount: relations.length,
    entities: [...entities.values()], relations, events,
    validation: { stateContinuityConflicts: events.flatMap(event => event.actions
      .filter(action => action.type === 'state_continuity_conflict')) },
    principles: ['Entity identities are independent of species or character archetype.',
      'Relations preserve actor-to-target direction.',
      'Natural-language relations are added only when named participants and an explicit action are grounded in the same sentence.',
      'Ambiguous or unlinked facts remain unresolved.'] };
}

/**
 * Build a unified, ordered film-memory view from existing grounded scene models.
 *
 * This is a deterministic join layer, not a natural-language understanding model
 * or visual verifier. It preserves source facts and explicit model links; unknown
 * fields remain null and missing causal links are never inferred.
 */
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clean = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const list = value => Array.isArray(value) ? value.filter(isRecord) : [];
const finite = value => typeof value === 'number' && Number.isFinite(value);

function sceneIdOf(scene, index) {
  return clean(scene?.id, 120) || `scene_${index + 1}`;
}

function eventTime(event) {
  if (finite(event.startSeconds)) return event.startSeconds;
  if (finite(event.start)) return event.start;
  return null;
}

function timelineEntry(kind, event, index) {
  return {
    id: `${kind}:${clean(event.id, 160) || index + 1}`,
    kind,
    sourceId: clean(event.id, 160) || null,
    sequence: finite(event.sequence) ? event.sequence : index + 1,
    start: eventTime(event),
    end: finite(event.endSeconds) ? event.endSeconds : (finite(event.end) ? event.end : null),
    actorId: clean(event.actorId, 160) || null,
    targetId: clean(event.targetId, 160) || null,
    entityId: clean(event.entityId, 160) || null,
    type: clean(event.type || event.phase, 80) || kind,
    description: clean(event.description, 700) || null,
    evidence: clean(event.evidence, 500) || null,
    grounded: event.grounded === true
  };
}

function compareTimeline(a, b) {
  if (a.start !== null && b.start !== null && a.start !== b.start) return a.start - b.start;
  if (a.start !== null && b.start === null) return -1;
  if (a.start === null && b.start !== null) return 1;
  return a.sequence - b.sequence || a.id.localeCompare(b.id);
}

/**
 * @param {Array<object>} scenes Original storyboard scene list in intended order.
 * @param {object} context Existing world/physics/causal/state model outputs.
 */
export function buildSceneFilmMemory(scenes = [], context = {}) {
  if (!Array.isArray(scenes)) {
    return { schemaVersion: 1, valid: false, sceneCount: 0, scenes: [],
      issues: [{ code: 'film-scenes-not-array', severity: 'error' }] };
  }

  const ids = scenes.map(sceneIdOf);
  const seen = new Set();
  const duplicateIds = new Set();
  for (const id of ids) {
    if (seen.has(id)) duplicateIds.add(id);
    seen.add(id);
  }
  if (duplicateIds.size) {
    return { schemaVersion: 1, valid: false, sceneCount: 0, scenes: [],
      issues: [...duplicateIds].sort().map(sceneId =>
        ({ code: 'duplicate-film-scene-id', severity: 'error', sceneId })) };
  }

  const world = isRecord(context.worldModel) ? context.worldModel : {};
  const physics = isRecord(context.physicsModel) ? context.physicsModel : {};
  const causal = isRecord(context.causalModel) ? context.causalModel : {};
  const continuity = isRecord(context.stateContinuity) ? context.stateContinuity : {};
  const worldEntities = list(world.entities);
  const worldRelations = list(world.relations);
  const worldEvents = list(world.events);
  const physicsEvents = list(physics.events);
  const causalEvents = list(causal.events);
  const causalEdges = list(causal.edges);
  const holderTimeline = list(physics.holderTimeline);
  const continuityIssues = list(continuity.issues);
  const filmScenes = [];

  scenes.forEach((rawScene, index) => {
    const scene = isRecord(rawScene) ? rawScene : {};
    const sceneId = ids[index];
    const worldEvent = worldEvents.find(event => event.sceneId === sceneId) || null;
    const entities = worldEntities.filter(entity =>
      Array.isArray(entity.scenes) && entity.scenes.includes(sceneId));
    const relations = worldRelations.filter(relation => relation.sceneId === sceneId);
    const scenePhysics = physicsEvents.filter(event => event.sceneId === sceneId);
    const sceneCausality = causalEvents.filter(event => event.sceneId === sceneId);
    const sceneEdges = causalEdges.filter(edge =>
      edge.fromSceneId === sceneId || edge.toSceneId === sceneId);
    const sceneHolderTimeline = holderTimeline.filter(item => item.sceneId === sceneId);
    const sceneIssues = continuityIssues.filter(issue =>
      issue.sceneId === sceneId || issue.previousSceneId === sceneId);

    const timeline = [];
    for (const [kind, events] of [
      ['world-action', list(worldEvent?.actions)],
      ['physics', scenePhysics],
      ['causal', sceneCausality]
    ]) {
      events.forEach((event, eventIndex) => timeline.push(timelineEntry(kind, event, eventIndex)));
    }
    timeline.sort(compareTimeline);

    filmScenes.push({
      sceneId,
      order: index + 1,
      title: clean(scene.title, 200) || null,
      purpose: clean(scene.purpose, 500) || null,
      environment: {
        location: clean(scene.location || scene.environmentDescription, 500) || null,
        lighting: clean(scene.environmentLighting, 300) || null,
        timeOfDay: clean(scene.timeOfDay, 120) || null,
        weather: clean(scene.weather, 120) || null,
        physics: (Array.isArray(physics.environments)
          ? physics.environments.find(item => item.sceneId === sceneId) : null) || null
      },
      characters: entities.filter(entity => entity.kind === 'character'),
      objects: entities.filter(entity => entity.kind !== 'character' && entity.kind !== 'location'),
      entities,
      relations,
      state: {
        start: isRecord(scene.startState) ? scene.startState : null,
        end: isRecord(scene.endState) ? scene.endState : null,
        changes: Array.isArray(scene.stateChanges) ? scene.stateChanges.filter(isRecord) : []
      },
      physicalEvents: scenePhysics,
      holderTransitions: sceneHolderTimeline,
      causalEvents: sceneCausality,
      causalEdges: sceneEdges,
      timeline,
      continuityIssues: sceneIssues
    });
  });

  const knownEntityIds = new Set(worldEntities.map(entity => clean(entity.id, 160)).filter(Boolean));
  const unresolvedReferences = [];
  for (const scene of filmScenes) {
    for (const relation of scene.relations) {
      for (const [role, id] of [['from', relation.from], ['to', relation.to]]) {
        if (id && knownEntityIds.size && !knownEntityIds.has(id)) {
          unresolvedReferences.push({ code: 'film-relation-entity-unresolved',
            severity: 'warning', sceneId: scene.sceneId, role, entityId: id });
        }
      }
    }
  }

  const issues = [...unresolvedReferences];
  const stateIssues = continuityIssues.map(issue => ({ ...issue }));
  return {
    schemaVersion: 1,
    valid: true,
    sceneCount: filmScenes.length,
    entityCount: worldEntities.length,
    eventCount: filmScenes.reduce((sum, scene) => sum + scene.timeline.length, 0),
    scenes: filmScenes,
    causalChains: list(causal.chains),
    continuity: {
      passed: continuity.passed === true,
      checkedTransitions: finite(continuity.checkedTransitions) ? continuity.checkedTransitions : 0,
      issues: stateIssues
    },
    issues,
    knowledgeRules: [
      'Scene order follows the supplied storyboard; it does not imply causation.',
      'Only model-supplied entities, relations, physical events and causal links are joined.',
      'A missing state, location, holder, measurement or transition remains unknown.',
      'This memory joins structured metadata and does not verify generated pixels or provider compliance.'
    ]
  };
}

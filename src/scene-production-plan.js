/**
 * Deterministic production blueprint for complete animation scenes.
 * Joins existing source-grounded story, world, physics, causal and edit data
 * into ordered passes for a renderer. It plans work; it does not claim to
 * render assets or invent missing actions, participants, timing or audio.
 */
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const finite = value => typeof value === 'number' && Number.isFinite(value);

function unique(values) {
  return [...new Set(values.map(value => clean(value, 160)).filter(Boolean))];
}

function worldActionsHaveParticipants(event) {
  return Array.isArray(event?.actions) && event.actions.some(action => record(action)
    && clean(action.actorId, 160) && clean(action.targetId, 160));
}

function normalizePhases(scene) {
  const phases = Array.isArray(scene.actionTimeline?.phases) ? scene.actionTimeline.phases : [];
  return phases.filter(record).map((phase, index) => ({
    id: clean(phase.id, 120) || `${clean(scene.id, 120)}_phase_${index + 1}`,
    phase: clean(phase.phase, 40) || 'action',
    start: finite(phase.start) ? phase.start : null,
    end: finite(phase.end) ? phase.end : null,
    actorId: clean(phase.actorId, 160) || null,
    targetId: clean(phase.targetId, 160) || null,
    description: clean(phase.description, 700),
    evidence: clean(phase.evidence, 500)
  })).sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
}


function buildGroundedCausalChains(causal) {
  const events = (Array.isArray(causal?.events) ? causal.events : []).filter(record);
  const counts = new Map();
  for (const event of events) {
    const id = clean(event.id, 160);
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  }
  const byId = new Map(events.filter(event => clean(event.id, 160) && counts.get(clean(event.id, 160)) === 1)
    .map(event => [clean(event.id, 160), event]));
  const edges = new Set((Array.isArray(causal?.edges) ? causal.edges : [])
    .filter(record).map(edge => `${clean(edge.fromEventId, 160)}->${clean(edge.toEventId, 160)}`));
  const chains = [];
  for (const raw of Array.isArray(causal?.chains) ? causal.chains : []) {
    if (!record(raw) || !Array.isArray(raw.eventIds) || raw.eventIds.length < 2) continue;
    const ids = raw.eventIds.map(id => clean(id, 160));
    if (ids.some(id => !id) || new Set(ids).size !== ids.length) continue;
    const sequence = ids.map(id => byId.get(id));
    if (sequence.some(event => !event || event.grounded !== true)) continue;
    if (ids.slice(1).some((id, index) => !edges.has(`${ids[index]}->${id}`))) continue;
    chains.push({
      id: clean(raw.id, 160) || `causal_chain_${chains.length + 1}`,
      eventIds: ids,
      sceneIds: unique(sequence.map(event => event.sceneId)),
      events: sequence.map(event => ({
        id: clean(event.id, 160),
        sceneId: clean(event.sceneId, 120),
        sequence: finite(event.sequence) ? event.sequence : null,
        type: clean(event.type, 40),
        actorId: clean(event.actorId, 160) || null,
        targetId: clean(event.targetId, 160) || null,
        entityId: clean(event.entityId, 160) || null,
        physicsEventId: clean(event.physicsEventId, 160) || null,
        evidence: clean(event.evidence, 500)
      }))
    });
  }
  return chains;
}

/** Build renderer-facing work orders from already validated semantic models. */
export function buildSceneProductionPlan(scenes = [], context = {}) {
  const list = Array.isArray(scenes) ? scenes.filter(record) : [];
  const world = context.worldModel || null;
  const physics = context.physicsModel || null;
  const causal = context.causalModel || null;
  const editing = context.editingPlan || null;
  const decisions = context.editDecisions || null;
  const causalChains = buildGroundedCausalChains(causal);
  const scenePlans = [];
  const issues = [];
  let cursor = 0;

  list.forEach((scene, index) => {
    const sceneId = clean(scene.id, 120) || `scene_${index + 1}`;
    const duration = finite(scene.durationSeconds) && scene.durationSeconds > 0
      ? scene.durationSeconds : 3;
    const cast = unique(Array.isArray(scene.characters) ? scene.characters : []);
    const phases = normalizePhases(scene);
    const shots = (Array.isArray(editing?.shots) ? editing.shots : [])
      .filter(shot => record(shot) && shot.sceneId === sceneId);
    const physicsEvents = (Array.isArray(physics?.events) ? physics.events : [])
      .filter(event => record(event) && event.sceneId === sceneId);
    const groundedPhysicsEvents = physicsEvents.filter(event => event.grounded === true);
    const causalEvents = (Array.isArray(causal?.events) ? causal.events : [])
      .filter(event => record(event) && event.sceneId === sceneId);
    const groundedCausalEvents = causalEvents.filter(event => event.grounded === true);
    const causalEdges = (Array.isArray(causal?.edges) ? causal.edges : [])
      .filter(edge => record(edge) && (edge.fromSceneId === sceneId || edge.toSceneId === sceneId));
    const causalChainRefs = causalChains.filter(chain => chain.sceneIds.includes(sceneId))
      .map(chain => ({ chainId: chain.id, eventIds: chain.eventIds }));
    const shotIds = new Set(shots.map(shot => shot.id));
    const editCuts = (Array.isArray(decisions?.cuts) ? decisions.cuts : [])
      .filter(cut => record(cut) && (shotIds.has(cut.fromShotId) || shotIds.has(cut.toShotId)));
    const dialogue = (Array.isArray(scene.dialogue) ? scene.dialogue : [])
      .filter(line => record(line) && clean(line.text, 2000))
      .map(line => ({ characterId: clean(line.characterId, 120) || null,
        text: clean(line.text, 2000), language: clean(line.language, 12) || null }));
    const audioCues = (Array.isArray(scene.audioCues) ? scene.audioCues : [])
      .filter(record).map(cue => ({ type: clean(cue.type, 60) || 'unspecified',
        startSeconds: finite(cue.startSeconds) ? cue.startSeconds : null,
        endSeconds: finite(cue.endSeconds) ? cue.endSeconds : null,
        description: clean(cue.description || cue.source, 300) }));
    const worldEvent = (Array.isArray(world?.events) ? world.events : [])
      .find(event => record(event) && event.sceneId === sceneId) || null;
    const worldEntities = (Array.isArray(world?.entities) ? world.entities : [])
      .filter(entity => record(entity) && Array.isArray(entity.scenes) && entity.scenes.includes(sceneId))
      .map(entity => ({ id: clean(entity.id, 160), kind: clean(entity.kind, 80) || 'entity',
        attributes: record(entity.attributes) ? entity.attributes : {} }));
    const worldRelations = (Array.isArray(world?.relations) ? world.relations : [])
      .filter(relation => record(relation) && relation.sceneId === sceneId);
    const propActions = (Array.isArray(scene.stateChanges) ? scene.stateChanges : [])
      .filter(change => record(change) && change.entityType === 'prop' && clean(change.entityId, 160))
      .map(change => ({ entityId: clean(change.entityId, 160), property: clean(change.property, 60),
        previousValue: change.previousValue ?? null, value: change.value ?? null,
        actorId: clean(change.actorId, 160) || null, actionIntent: clean(change.actionIntent, 60) || null,
        evidence: clean(change.evidence, 500) }));
    const requiredPasses = [];
    if (clean(scene.imagePrompt, 4000) || clean(scene.prompt, 4000)) requiredPasses.push('visual-establishing-frame');
    if (cast.length) requiredPasses.push('character-layer-composition');
    if (phases.length || clean(scene.motionPrompt, 3000) || clean(scene.visibleAction, 1000)) {
      requiredPasses.push('character-and-object-motion');
    }
    if (worldRelations.length || worldActionsHaveParticipants(worldEvent)) {
      requiredPasses.push('multi-entity-interaction');
    }
    if (propActions.length) requiredPasses.push('prop-state-and-motion');
    if (groundedPhysicsEvents.length) requiredPasses.push('grounded-physical-interaction');
    if (causalChainRefs.length) requiredPasses.push('causal-interaction-sequence');
    if (dialogue.length) requiredPasses.push('dialogue-voice-and-timing');
    if (dialogue.length || audioCues.length || clean(scene.sound, 1000)) requiredPasses.push('scene-audio-mix');
    if (requiredPasses.length) requiredPasses.push('scene-compositing-and-export');

    if (!cast.length && (phases.some(phase => phase.actorId) || causalEvents.some(event => event.actorId))) {
      issues.push({ code: 'production-actor-not-in-scene-cast', severity: 'warning', sceneId });
    }
    if (shots.length && shots.some(shot => !finite(shot.startSeconds) || !finite(shot.endSeconds)
      || shot.endSeconds <= shot.startSeconds)) {
      issues.push({ code: 'production-shot-timing-invalid', severity: 'error', sceneId });
    }
    if (dialogue.some(line => line.characterId && cast.length && !cast.includes(line.characterId))) {
      issues.push({ code: 'dialogue-speaker-not-in-scene-cast', severity: 'warning', sceneId });
    }

    scenePlans.push({
      sceneId,
      sceneOrder: index + 1,
      timeline: { startSeconds: Number(cursor.toFixed(3)),
        endSeconds: Number((cursor + duration).toFixed(3)), durationSeconds: duration },
      dramaticPurpose: clean(scene.purpose, 500),
      setting: { location: clean(scene.location, 500) || null,
        environment: clean(scene.environmentDescription, 1000) || null,
        lighting: clean(scene.environmentLighting, 300) || null,
        timeOfDay: clean(scene.timeOfDay, 120) || null },
      cast,
      visual: { imagePrompt: clean(scene.imagePrompt || scene.prompt, 4000),
        camera: clean(scene.camera, 1000), motionPrompt: clean(scene.motionPrompt, 3000) },
      actionBeats: phases,
      worldActions: Array.isArray(worldEvent?.actions) ? worldEvent.actions : [],
      worldEntities,
      worldRelations,
      propActions,
      physicalBeats: groundedPhysicsEvents,
      unresolvedPhysicalBeats: physicsEvents.filter(event => event.grounded !== true),
      causalBeats: groundedCausalEvents,
      unresolvedCausalBeats: causalEvents.filter(event => event.grounded !== true),
      causalEdges,
      causalChainRefs,
      shots,
      editCuts,
      dialogue,
      audioCues,
      continuity: { startState: clean(scene.startState, 1000),
        endState: clean(scene.endState, 1000),
        stateChanges: Array.isArray(scene.stateChanges) ? scene.stateChanges.filter(record) : [] },
      requiredPasses
    });
    cursor += duration;
  });

  const shotCount = scenePlans.reduce((sum, scene) => sum + scene.shots.length, 0);
  return {
    schemaVersion: 1,
    sceneCount: scenePlans.length,
    shotCount,
    totalDurationSeconds: Number(cursor.toFixed(3)),
    scenes: scenePlans,
    causalChains,
    validation: { passed: !issues.some(issue => issue.severity === 'error'), issues },
    constraints: [
      'Production passes are work orders, not proof that a renderer completed them.',
      'Only grounded physics and causal events are scheduled as production beats; unresolved events remain diagnostic data.',
      'A causal interaction sequence is emitted only when every event is grounded, event IDs are unique, and every adjacent edge is explicitly present.',
      'Action beats, dialogue, audio cues and shot timing retain supplied source data.',
      'Missing actors, props, assets, measurements and causal links are never fabricated.',
      'Scene order and timeline follow the supplied storyboard order.'
    ]
  };
}

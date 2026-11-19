import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneProductionPlan } from '../src/scene-production-plan.js';

test('assembles a complete scene work order from grounded story, action, edit and audio data', () => {
  const plan = buildSceneProductionPlan([{
    id: 'scene-1',
    durationSeconds: 4,
    purpose: 'Show the hand-off',
    location: 'Workshop',
    characters: ['Mira', 'Leo'],
    imagePrompt: 'Mira and Leo beside a workbench',
    camera: 'Medium two-shot',
    motionPrompt: 'Mira hands Leo the wrench',
    actionTimeline: { phases: [{
      id: 'handoff', phase: 'action', start: 0.2, end: 0.8,
      actorId: 'Mira', targetId: 'Leo',
      description: 'Mira hands Leo the wrench',
      evidence: 'Mira hands Leo the wrench.'
    }] },
    dialogue: [{ characterId: 'Mira', text: 'Here you go.', language: 'en' }],
    audioCues: [{ type: 'foley', startSeconds: 1, endSeconds: 2, description: 'Tool movement' }],
    stateChanges: [{ entityId: 'wrench', property: 'holder', previousValue: 'Mira', value: 'Leo' }],
    startState: 'Mira holds the wrench.',
    endState: 'Leo holds the wrench.'
  }], {
    worldModel: { events: [{ sceneId: 'scene-1', actions: [{ type: 'handoff', actorId: 'Mira', targetId: 'Leo' }] }] },
    physicsModel: { events: [{ id: 'p1', sceneId: 'scene-1', type: 'transfer', grounded: true }] },
    causalModel: {
      events: [{ id: 'c1', sceneId: 'scene-1', type: 'action', grounded: true }],
      edges: [{ fromSceneId: 'scene-1', toSceneId: 'scene-1', fromEventId: 'c1', toEventId: 'c2' }]
    },
    editingPlan: { shots: [{ id: 'shot-1', sceneId: 'scene-1', startSeconds: 0, endSeconds: 4 }] },
    editDecisions: { cuts: [{ fromShotId: 'shot-1', toShotId: 'shot-2', type: 'match_cut' }] }
  });

  assert.equal(plan.sceneCount, 1);
  assert.equal(plan.shotCount, 1);
  assert.equal(plan.totalDurationSeconds, 4);
  const scene = plan.scenes[0];
  assert.deepEqual(scene.cast, ['Mira', 'Leo']);
  assert.equal(scene.actionBeats[0].actorId, 'Mira');
  assert.equal(scene.physicalBeats[0].id, 'p1');
  assert.equal(scene.causalBeats[0].id, 'c1');
  assert.equal(scene.dialogue[0].text, 'Here you go.');
  assert.ok(scene.requiredPasses.includes('character-layer-composition'));
  assert.ok(scene.requiredPasses.includes('grounded-physical-interaction'));
  assert.ok(scene.requiredPasses.includes('dialogue-voice-and-timing'));
  assert.ok(scene.requiredPasses.includes('scene-compositing-and-export'));
});

test('keeps ungrounded physics and causal events out of scheduled production beats', () => {
  const plan = buildSceneProductionPlan([{ id: 's1', durationSeconds: 2 }], {
    physicsModel: { events: [{ id: 'p1', sceneId: 's1', grounded: false }] },
    causalModel: { events: [{ id: 'c1', sceneId: 's1', grounded: false }] }
  });
  assert.deepEqual(plan.scenes[0].physicalBeats, []);
  assert.deepEqual(plan.scenes[0].causalBeats, []);
  assert.equal(plan.scenes[0].unresolvedPhysicalBeats[0].id, 'p1');
  assert.equal(plan.scenes[0].unresolvedCausalBeats[0].id, 'c1');
  assert.ok(!plan.scenes[0].requiredPasses.includes('grounded-physical-interaction'));
});

test('reports missing cast attribution and dialogue speakers outside the cast', () => {
  const plan = buildSceneProductionPlan([{
    id: 's1',
    actionTimeline: { phases: [{ actorId: 'Unknown', start: 0, end: 1, description: 'Acts' }] },
    dialogue: [{ characterId: 'Unknown', text: 'Hello' }]
  }]);
  assert.ok(plan.validation.issues.some(issue => issue.code === 'production-actor-not-in-scene-cast'));
});


test('exposes the complete scene world and explicit prop hand-offs to renderer work orders', () => {
  const plan = buildSceneProductionPlan([{
    id: 's-world',
    characters: ['Mira'],
    stateChanges: [{ entityType: 'prop', entityId: 'key', property: 'holder',
      previousValue: 'Mira', value: 'robot-1', actorId: 'Mira', actionIntent: 'hand',
      evidence: 'Mira gives the key to the robot.' }]
  }], {
    worldModel: {
      entities: [
        { id: 'Mira', kind: 'character', scenes: ['s-world'], attributes: {} },
        { id: 'robot-1', kind: 'robot', scenes: ['s-world'], attributes: { material: 'metal' } },
        { id: 'key', kind: 'prop', scenes: ['s-world'], attributes: {} },
        { id: 'street', kind: 'location', scenes: ['other-scene'], attributes: {} }
      ],
      relations: [{ sceneId: 's-world', type: 'acts_on', from: 'Mira', to: 'robot-1', action: 'give' }],
      events: [{ sceneId: 's-world', actions: [{ type: 'give', actorId: 'Mira', targetId: 'robot-1' }] }]
    }
  });
  const scene = plan.scenes[0];
  assert.deepEqual(scene.worldEntities.map(entity => entity.id), ['Mira', 'robot-1', 'key']);
  assert.equal(scene.worldEntities.find(entity => entity.id === 'robot-1').kind, 'robot');
  assert.equal(scene.worldRelations[0].to, 'robot-1');
  assert.equal(scene.propActions[0].value, 'robot-1');
  assert.ok(scene.requiredPasses.includes('multi-entity-interaction'));
  assert.ok(scene.requiredPasses.includes('prop-state-and-motion'));
});


test('schedules complete grounded causal interaction chains in scene work orders', () => {
  const events = [
    { id: 'push', sceneId: 's1', sequence: 1, type: 'action', actorId: 'Mira', entityId: 'cart', grounded: true, evidence: 'Mira pushes the cart.' },
    { id: 'move', sceneId: 's1', sequence: 2, type: 'effect', entityId: 'cart', grounded: true, evidence: 'The cart rolls forward.' },
    { id: 'collision', sceneId: 's2', sequence: 3, type: 'physical_event', entityId: 'cart', targetId: 'crate', physicsEventId: 'impact', grounded: true, evidence: 'The cart hits the crate.' },
    { id: 'crate-falls', sceneId: 's2', sequence: 4, type: 'effect', entityId: 'crate', grounded: true, evidence: 'The crate falls over.' },
    { id: 'react', sceneId: 's3', sequence: 5, type: 'reaction', actorId: 'Mira', grounded: true, evidence: 'Mira jumps back.' }
  ];
  const causalModel = {
    events,
    edges: events.slice(1).map((event, index) => ({
      fromEventId: events[index].id, toEventId: event.id,
      fromSceneId: events[index].sceneId, toSceneId: event.sceneId
    })),
    chains: [{ id: 'cart-chain', eventIds: events.map(event => event.id) }]
  };
  const plan = buildSceneProductionPlan([
    { id: 's1', characters: ['Mira'] },
    { id: 's2', characters: ['Mira'] },
    { id: 's3', characters: ['Mira'] }
  ], { causalModel });

  assert.equal(plan.causalChains.length, 1);
  assert.deepEqual(plan.causalChains[0].eventIds, ['push', 'move', 'collision', 'crate-falls', 'react']);
  assert.equal(plan.causalChains[0].events[2].physicsEventId, 'impact');
  assert.deepEqual(plan.scenes.map(scene => scene.causalChainRefs[0]?.chainId), [
    'cart-chain', 'cart-chain', 'cart-chain'
  ]);
  assert.deepEqual(plan.scenes.map(scene =>
    scene.causalChainDetails[0]?.events.filter(event => event.occursInCurrentScene).map(event => event.id)
  ), [['push', 'move'], ['collision', 'crate-falls'], ['react']]);
  assert.ok(plan.scenes.every(scene => scene.requiredPasses.includes('causal-interaction-sequence')));
});

test('does not schedule incomplete, ungrounded, duplicated or edge-less causal chains', () => {
  const plan = buildSceneProductionPlan([{ id: 's1' }, { id: 's2' }], {
    causalModel: {
      events: [
        { id: 'push', sceneId: 's1', grounded: true },
        { id: 'move', sceneId: 's2', grounded: false },
        { id: 'duplicate', sceneId: 's2', grounded: true },
        { id: 'duplicate', sceneId: 's2', grounded: true }
      ],
      edges: [{ fromEventId: 'push', toEventId: 'move' }],
      chains: [
        { id: 'ungrounded', eventIds: ['push', 'move'] },
        { id: 'duplicate-id', eventIds: ['duplicate', 'push'] },
        { id: 'missing-edge', eventIds: ['push', 'duplicate'] },
        { id: 'single', eventIds: ['push'] }
      ]
    }
  });
  assert.deepEqual(plan.causalChains, []);
  assert.ok(plan.scenes.every(scene => !scene.requiredPasses.includes('causal-interaction-sequence')));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneProductionContext } from '../src/scene-production-runtime.js';

test('builds a fresh renderer work order from the exact scenes being rendered', () => {
  const scenes = [{
    id: 'scene-handoff',
    durationSeconds: 4,
    characters: ['Mira', 'Leo'],
    storyDetail: 'Mira gives Leo the key. The key lands in Leo\'s hand.',
    visibleAction: 'Mira hands the key to Leo.',
    camera: 'Medium two-shot',
    actionTimeline: { phases: [{
      phase: 'action', start: 0.2, end: 0.8,
      actorId: 'Mira', targetId: 'Leo',
      description: 'Mira gives Leo the key.',
      evidence: 'Mira gives Leo the key.'
    }] },
    interactions: [{ type: 'give', actorId: 'Mira', targetId: 'Leo', evidence: 'Mira gives Leo the key.' }],
    physicsEvents: [{ id: 'key-transfer', type: 'transfer', entityId: 'key', evidence: 'Mira gives Leo the key.', contact: true }],
    causalEvents: [
      { id: 'handoff', type: 'action', actorId: 'Mira', targetId: 'Leo', evidence: 'Mira gives Leo the key.' },
      { id: 'received', type: 'effect', entityId: 'key', actorId: 'Leo', evidence: "The key lands in Leo's hand.", causedByEventId: 'handoff', physicsEventId: 'key-transfer' }
    ],
    stateChanges: [{
      entityType: 'prop', entityId: 'key', property: 'holder',
      previousValue: null, value: 'Mira', actorId: 'Mira',
      actionIntent: 'pick_up', evidence: 'Mira picks up the key.'
    }],
    dialogue: [{ characterId: 'Mira', text: 'Take the key.', language: 'en' }],
    audioCues: [{ type: 'foley', startSeconds: 1, description: 'metal click' }]
  }];

  const context = buildSceneProductionContext(scenes, { language: 'en' });
  const scenePlan = context.productionPlan.scenes[0];

  assert.equal(context.productionPlan.sceneCount, 1);
  assert.equal(context.physicsModel.groundedEventCount, 1);
  assert.equal(context.causalModel.edges.length, 1);
  assert.equal(scenePlan.sceneId, 'scene-handoff');
  assert.deepEqual(scenePlan.cast, ['Mira', 'Leo']);
  assert.ok(scenePlan.worldEntities.some(entity => entity.id === 'key' && entity.kind === 'prop'));
  assert.ok(scenePlan.worldRelations.some(relation => relation.from === 'Mira' && relation.to === 'Leo'));
  assert.equal(scenePlan.propActions[0].value, 'Mira');
  assert.equal(scenePlan.physicalBeats.length, 1);
  assert.equal(scenePlan.causalBeats.length, 2);
  assert.equal(scenePlan.dialogue[0].text, 'Take the key.');
  assert.equal(scenePlan.audioCues[0].description, 'metal click');
  assert.ok(scenePlan.requiredPasses.includes('multi-entity-interaction'));
  assert.ok(scenePlan.requiredPasses.includes('grounded-physical-interaction'));
  assert.ok(scenePlan.requiredPasses.includes('prop-state-and-motion'));
  assert.ok(scenePlan.requiredPasses.includes('dialogue-voice-and-timing'));
});

test('rebuilds production context after scene edits instead of reusing stale IDs or facts', () => {
  const first = buildSceneProductionContext([{ id: 'old-scene', characters: ['Mira'] }]);
  const second = buildSceneProductionContext([{ id: 'new-scene', characters: ['Noah'] }]);
  assert.equal(first.productionPlan.scenes[0].sceneId, 'old-scene');
  assert.equal(second.productionPlan.scenes[0].sceneId, 'new-scene');
  assert.deepEqual(second.productionPlan.scenes[0].cast, ['Noah']);
  assert.equal(second.productionPlan.scenes[0].worldEntities.some(entity => entity.id === 'Mira'), false);
});


test('attaches state continuity QA to scene work orders and provider instructions', async () => {
  const { buildSceneProductionInstructions } = await import('../src/scene-production-instructions.js');
  const baseState = {
    characters: { Mira: { location: 'village' } },
    objects: { key: { owner: 'Mira', state: 'held' } }
  };
  const nextState = {
    characters: { Mira: { location: 'castle' } },
    objects: { key: { owner: 'Mira', state: 'held' } }
  };
  const context = buildSceneProductionContext([
    { id: 'scene-village', characters: ['Mira'], startState: baseState, endState: baseState },
    { id: 'scene-castle', characters: ['Mira'], startState: nextState, endState: nextState }
  ]);
  const nextPlan = context.productionPlan.scenes[1];
  const prompt = buildSceneProductionInstructions(nextPlan);

  assert.equal(context.stateContinuity.passed, false);
  assert.ok(context.stateContinuity.issues.some(issue => issue.code === 'character-teleportation'));
  assert.ok(nextPlan.continuityIssues.some(issue => issue.code === 'character-teleportation'));
  assert.match(prompt, /Continuity QA warnings to reconcile/);
  assert.match(prompt, /never invent a journey/);
});

test('passes clean state continuity into production plans without adding warnings', () => {
  const state = {
    characters: { Mira: { location: 'village' } },
    objects: { key: { owner: 'Mira', state: 'held' } }
  };
  const context = buildSceneProductionContext([
    { id: 'scene-one', characters: ['Mira'], startState: state, endState: state },
    { id: 'scene-two', characters: ['Mira'], startState: state, endState: state }
  ]);

  assert.equal(context.stateContinuity.passed, true);
  assert.deepEqual(context.productionPlan.scenes[0].continuityIssues, []);
  assert.deepEqual(context.productionPlan.scenes[1].continuityIssues, []);
});


test('injects previous-scene memory and current causal timeline into provider work orders', async () => {
  const { buildSceneProductionInstructions } = await import('../src/scene-production-instructions.js');
  const scenes = [
    {
      id: 'scene-village',
      title: 'The key is found',
      characters: ['Mira'],
      location: 'village square',
      storyDetail: 'Mira holds the key.',
      visibleAction: 'Mira holds the key.',
      endState: {
        characters: { Mira: { location: 'village square' } },
        objects: { key: { owner: 'Mira', state: 'held' } }
      },
      stateChanges: [{ entityType: 'prop', entityId: 'key', property: 'owner',
        previousValue: null, value: 'Mira', actorId: 'Mira',
        actionIntent: 'pick_up', evidence: 'Mira holds the key.' }]
    },
    {
      id: 'scene-bridge',
      title: 'The key is handed over',
      characters: ['Mira', 'Leo'],
      location: 'stone bridge',
      storyDetail: 'Mira gives Leo the key.',
      visibleAction: 'Mira gives Leo the key.',
      startState: {
        characters: { Mira: { location: 'stone bridge' }, Leo: { location: 'stone bridge' } },
        objects: { key: { owner: 'Leo', state: 'held' } }
      },
      stateChanges: [
        { entity: 'key', property: 'owner', previousValue: 'Mira', value: 'Leo',
          evidence: 'Mira gives Leo the key.' },
        { entityType: 'prop', entityId: 'key', property: 'owner',
          previousValue: 'Mira', value: 'Leo', actorId: 'Mira',
          actionIntent: 'handoff', evidence: 'Mira gives Leo the key.' }
      ],
      physicsEvents: [{ id: 'key-handoff', type: 'transfer', entityId: 'key',
        fromEntityId: 'Mira', toEntityId: 'Leo', actorId: 'Mira',
        evidence: 'Mira gives Leo the key.' }],
      causalEvents: [
        { id: 'give-key', type: 'action', actorId: 'Mira', targetId: 'Leo',
          entityId: 'key', evidence: 'Mira gives Leo the key.' },
        { id: 'key-received', type: 'effect', actorId: 'Leo', entityId: 'key',
          causedByEventId: 'give-key', evidence: 'Mira gives Leo the key.' }
      ]
    }
  ];

  const context = buildSceneProductionContext(scenes, { language: 'en' });
  const bridgePlan = context.productionPlan.scenes[1];
  const prompt = buildSceneProductionInstructions(bridgePlan);

  assert.equal(context.filmMemory.sceneCount, 2);
  assert.equal(bridgePlan.filmMemoryContext.previousScene.sceneId, 'scene-village');
  assert.equal(bridgePlan.filmMemoryContext.previousScene.endState.objects.key.owner, 'Mira');
  assert.equal(bridgePlan.filmMemoryContext.currentScene.sceneId, 'scene-bridge');
  assert.equal(bridgePlan.filmMemoryContext.currentScene.holderTransitions[0].holderAfter, 'Leo');
  assert.ok(bridgePlan.filmMemoryContext.currentScene.causalEdges.some(edge =>
    edge.fromEventId === 'give-key' && edge.toEventId === 'key-received'));
  assert.match(prompt, /Previous scene ending/);
  assert.match(prompt, /Unified current-scene memory/);
  assert.match(prompt, /stone bridge/);
});

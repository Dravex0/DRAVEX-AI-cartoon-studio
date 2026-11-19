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

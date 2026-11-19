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

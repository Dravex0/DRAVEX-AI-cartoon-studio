import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProceduralStandInScenePlan } from '../src/procedural-stand-in-scene-plan.js';

test('creates stand-ins only for explicitly cast characters without ready character art', () => {
  const plan = buildProceduralStandInScenePlan({
    characters: ['Kel', 'Mira', 'Rook'],
    characterLayers: [{ characterId: 'Mira', x: 0.7, y: 0.76, imageUrl: 'blob:mira' }],
    characterRigs: [{ characterId: 'Rook' }]
  });
  assert.deepEqual(plan.map(actor => actor.characterId), ['Kel']);
  assert.equal(plan[0].x, 0.23);
  assert.equal(plan[0].action, 'idle');
});

test('plans a source-grounded character-to-character wave interaction', () => {
  const plan = buildProceduralStandInScenePlan({
    characters: ['Kel', 'Mira'],
    actionTimeline: { schemaVersion: 1, phases: [
      { phase: 'action', start: 0, end: 1, actorId: 'Kel', targetId: 'Mira', description: 'Kel waves to Mira.', evidence: 'Kel waves to Mira.' }
    ] }
  });
  assert.equal(plan.length, 2);
  const kel = plan.find(actor => actor.characterId === 'Kel');
  const mira = plan.find(actor => actor.characterId === 'Mira');
  assert.equal(kel.action, 'wave');
  assert.deepEqual(kel.target, { x: 0.69, y: 0.67 });
  assert.equal(mira.action, 'idle');
});

test('animates both explicitly named partners for a team-magic event', () => {
  const plan = buildProceduralStandInScenePlan({
    characters: ['Kel', 'Mira'],
    semanticActionIntent: { intent: 'team_magic', motionCue: 'magic' },
    actionTimeline: { schemaVersion: 1, phases: [
      { phase: 'action', start: 0, end: 1, actorId: 'Kel', targetId: 'Mira', description: 'Kel and Mira combine their magic.' }
    ] }
  });
  assert.equal(plan.find(actor => actor.characterId === 'Kel').action, 'magic');
  assert.equal(plan.find(actor => actor.characterId === 'Mira').action, 'magic');
});

test('keeps the branch contact hand while the free hand reaches toward the bird', () => {
  const plan = buildProceduralStandInScenePlan({
    characters: ['Kel'],
    stateChanges: [
      { entityType: 'prop', entityId: 'fallen branch', property: 'holder', previousValue: null, value: 'Kel', actorId: 'Kel' },
      { entityType: 'prop', entityId: 'small mechanical bird', property: 'state', previousValue: 'trapped', value: 'free', actorId: 'Kel' }
    ],
    propStates: [
      { entityType: 'prop', entityId: 'fallen branch', property: 'holder', startValue: null, value: 'Kel' },
      { entityType: 'prop', entityId: 'small mechanical bird', property: 'state', startValue: 'trapped', value: 'free' }
    ],
    propAnchors: { 'small mechanical bird': { x: 0.54, y: 0.755 } },
    actionTimeline: { schemaVersion: 1, phases: [
      { phase: 'action', start: 0, end: 1, actorId: 'Kel', targetId: 'small mechanical bird', description: 'Kel frees the small mechanical bird.' }
    ] }
  });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].held, true);
  assert.deepEqual(plan[0].heldTarget, { x: 0.52, y: 0.67 });
  assert.deepEqual(plan[0].target, { x: 0.54, y: 0.755 });
  assert.equal(plan[0].action, 'reach');
});

test('never creates stand-ins for characters absent from the locked scene cast', () => {
  assert.deepEqual(buildProceduralStandInScenePlan({
    storyDetail: 'A quiet clearing at dawn.',
    characterLayers: []
  }), []);
});

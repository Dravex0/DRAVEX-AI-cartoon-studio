import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneInteractionModel, formatSceneInteractionInstructions } from '../src/scene-interaction-model.js';

test('builds grounded interaction links between actor, object and receiver', () => {
  const scene = {
    storyDetail: 'Mira throws the ball to Noah. Noah catches the ball.',
    characters: ['Mira', 'Noah'],
    physicsEvents: [
      { id: 'throw', type: 'throw', entityId: 'ball', actorId: 'Mira', targetId: 'Noah', contact: true,
        start: 0.1, end: 0.45, evidence: 'Mira throws the ball to Noah.' },
      { id: 'catch', type: 'catch', entityId: 'ball', actorId: 'Noah', targetId: 'ball', contact: true,
        start: 0.45, end: 0.7, evidence: 'Noah catches the ball.' }
    ]
  };
  const model = buildSceneInteractionModel(scene);
  assert.equal(model.status, 'grounded-interactions');
  assert.equal(model.eventCount, 2);
  assert.deepEqual(model.events.map(event => event.type), ['throw', 'catch']);
  assert.deepEqual(model.events.map(event => [event.start, event.end]), [[0.1, 0.45], [0.45, 0.7]]);
  assert.ok(model.entities.some(entity => entity.id === 'Mira' && entity.roles.includes('actor')));
  assert.ok(model.entities.some(entity => entity.id === 'Noah'));
  const prompt = formatSceneInteractionInstructions(model);
  assert.match(prompt, /one physical object has one location and at most one holder/i);
  assert.match(prompt, /handoff must not duplicate the object/i);
});

test('does not create interaction edges from ungrounded or missing evidence', () => {
  const model = buildSceneInteractionModel({
    storyDetail: 'Mira looks at the ball.',
    physicsEvents: [{
      id: 'invented-grasp', type: 'grasp', entityId: 'ball', actorId: 'Mira',
      evidence: 'Mira grasps the ball.'
    }]
  });
  assert.equal(model.eventCount, 0);
  assert.equal(model.status, 'no-grounded-interactions');
  assert.equal(formatSceneInteractionInstructions(model), '');
});

test('preserves unknown contact state instead of assuming a collision or grip', () => {
  const model = buildSceneInteractionModel({
    storyDetail: 'Mira pushes the cart.',
    physicsEvents: [{
      id: 'push', type: 'push', entityId: 'cart', actorId: 'Mira',
      evidence: 'Mira pushes the cart.'
    }]
  });
  assert.equal(model.events[0].contact, null);
  assert.match(formatSceneInteractionInstructions(model), /Contact state is unknown/);
});

test('models a single-holder handoff and prevents simultaneous ownership', () => {
  const model = buildSceneInteractionModel({
    storyDetail: 'Mira grasps the key. Mira gives the key to Noah.',
    physicsEvents: [
      { id: 'grasp', type: 'grasp', entityId: 'key', actorId: 'Mira', evidence: 'Mira grasps the key.' },
      { id: 'transfer', type: 'transfer', entityId: 'key', fromEntityId: 'Mira', toEntityId: 'Noah',
        evidence: 'Mira gives the key to Noah.' }
    ]
  });
  assert.deepEqual(model.holderTimeline.map(item => item.holderAfter), ['Mira', 'Noah']);
  assert.match(formatSceneInteractionInstructions(model), /at most one holder at a time/);
});

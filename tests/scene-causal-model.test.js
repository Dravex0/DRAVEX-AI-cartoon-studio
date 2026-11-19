import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneCausalModel } from '../src/scene-causal-model.js';

test('links a grounded action to its explicit physical effect and reaction', () => {
  const scenes = [
    { id: 's1', storyDetail: 'Mira pushes the cart.',
      causalEvents: [{ id: 'push', type: 'action', actorId: 'Mira', entityId: 'cart', evidence: 'Mira pushes the cart.' }] },
    { id: 's2', storyDetail: 'The cart rolls into the box.',
      causalEvents: [{ id: 'roll', type: 'effect', entityId: 'cart', causedByEventId: 'push', evidence: 'The cart rolls into the box.' }] },
    { id: 's3', storyDetail: 'Mira reacts with surprise.',
      causalEvents: [{ id: 'surprise', type: 'reaction', actorId: 'Mira', causedByEventId: 'roll', evidence: 'Mira reacts with surprise.' }] }
  ];
  const model = buildSceneCausalModel(scenes);
  assert.equal(model.eventCount, 3);
  assert.equal(model.linkedEventCount, 2);
  assert.deepEqual(model.chains[0].eventIds, ['push', 'roll', 'surprise']);
});

test('does not infer a causal edge from scene order alone', () => {
  const model = buildSceneCausalModel([
    { id: 'a', storyDetail: 'A character opens the door.',
      causalEvents: [{ id: 'open', type: 'action', evidence: 'A character opens the door.' }] },
    { id: 'b', storyDetail: 'A bird flies away.',
      causalEvents: [{ id: 'fly', type: 'effect', evidence: 'A bird flies away.' }] }
  ]);
  assert.equal(model.linkedEventCount, 0);
  assert.equal(model.chains.length, 2);
});

test('rejects unsupported evidence and a cause that appears later', () => {
  const model = buildSceneCausalModel([
    { id: 'effect', storyDetail: 'The lamp falls.',
      causalEvents: [{ id: 'fall', type: 'effect', causedByEventId: 'push', evidence: 'The lamp falls.' }] },
    { id: 'cause', storyDetail: 'A hand pushes the table.',
      causalEvents: [{ id: 'push', type: 'action', evidence: 'A hand pushes the table.' }] }
  ]);
  assert.equal(model.linkedEventCount, 0);
  assert.ok(model.validation.issues.some(issue => issue.code === 'causal-edge-unresolved-or-invalid'));
});

test('checks optional world and physics references without fabricating missing data', () => {
  const model = buildSceneCausalModel([{
    id: 's1', storyDetail: 'Rex strikes the drum.',
    causalEvents: [{ id: 'hit', type: 'physical_event', actorId: 'Rex', physicsEventId: 'missing', evidence: 'Rex strikes the drum.' }]
  }], { entities: [{ id: 'Rex' }] }, { events: [] });
  assert.ok(model.validation.issues.some(issue => issue.code === 'causal-physics-event-unresolved'));
  assert.equal(model.events[0].entityId, null);
});

test('duplicate event IDs cannot be used to create ambiguous causal links', () => {
  const model = buildSceneCausalModel([{
    id: 's1', storyDetail: 'One action occurs. Another action occurs.',
    causalEvents: [
      { id: 'same', type: 'action', evidence: 'One action occurs.' },
      { id: 'same', type: 'effect', causedByEventId: 'same', evidence: 'Another action occurs.' }
    ]
  }]);
  assert.equal(model.linkedEventCount, 0);
});

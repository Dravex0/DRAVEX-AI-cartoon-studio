import test from 'node:test';
import assert from 'node:assert/strict';
import { inferStoryboardStateChanges } from '../src/scene-state-changes.js';

test('does not attribute another character action to the first character mentioned', () => {
  const changes = inferStoryboardStateChanges([
    { storyDetail: 'Foxy watches as Bird picks up the silver key.', characters: ['Foxy', 'Bird'] }
  ], 'en');
  assert.equal(changes[0].length, 1);
  assert.equal(changes[0][0].actorId, 'Bird');
  assert.equal(changes[0][0].value, 'Bird');
});

test('does not assign another character location change to the first character mentioned', () => {
  const changes = inferStoryboardStateChanges([
    { storyDetail: 'Foxy watches as Bird enters the cave.', characters: ['Foxy', 'Bird'] }
  ], 'en');
  assert.equal(changes[0].length, 1);
  assert.equal(changes[0][0].entityType, 'character');
  assert.equal(changes[0][0].entityId, 'Bird');
  assert.equal(changes[0][0].value, 'inside:cave');
});

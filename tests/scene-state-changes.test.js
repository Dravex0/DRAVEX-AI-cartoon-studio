import test from 'node:test';
import assert from 'node:assert/strict';
import { inferStoryboardStateChanges } from '../src/scene-state-changes.js';

test('tracks an explicitly picked-up prop and carries its holder into later scenes', () => {
  const changes = inferStoryboardStateChanges([
    { id: 's1', storyDetail: 'Foxy picks up the silver key.', characters: ['Foxy'] },
    { id: 's2', storyDetail: 'Foxy holds the silver key while opening the gate.', characters: ['Foxy'] },
    { id: 's3', storyDetail: 'Foxy drops the silver key.', characters: ['Foxy'] }
  ], 'en');
  assert.equal(changes[0][0].property, 'holder');
  assert.equal(changes[0][0].value, 'Foxy');
  assert.deepEqual(changes[1], []);
  assert.equal(changes[2][0].previousValue, 'Foxy');
  assert.equal(changes[2][0].value, null);
});

test('tracks explicit door state changes in Russian and Ukrainian', () => {
  const ru = inferStoryboardStateChanges([
    { storyDetail: 'Лиса открывает дверь.', characters: ['Лиса'] },
    { storyDetail: 'Лиса закрывает дверь.', characters: ['Лиса'] }
  ], 'ru');
  const uk = inferStoryboardStateChanges([
    { storyDetail: 'Лисиця відкриває двері.', characters: ['Лисиця'] }
  ], 'uk');
  assert.equal(ru[0][0].value, 'open');
  assert.equal(ru[1][0].previousValue, 'open');
  assert.equal(ru[1][0].value, 'closed');
  assert.equal(uk[0][0].value, 'open');
});

test('tracks explicit character location changes without guessing pronouns', () => {
  const changes = inferStoryboardStateChanges([
    { storyDetail: 'Foxy enters the cave.', characters: ['Foxy'] },
    { storyDetail: 'Foxy leaves the cave.', characters: ['Foxy'] }
  ], 'en');
  assert.deepEqual(changes[0].map(change => change.value), ['inside:the cave']);
  assert.deepEqual(changes[1].map(change => [change.previousValue, change.value]), [
    ['inside:the cave', 'outside:the cave']
  ]);
});

test('does not infer a state change without a known named actor and explicit action', () => {
  assert.deepEqual(inferStoryboardStateChanges([
    { storyDetail: 'The fox picks up the silver key.', characters: ['Foxy'] },
    { storyDetail: 'Foxy might have opened the gate.', characters: ['Foxy'] }
  ], 'en'), [[], []]);
});

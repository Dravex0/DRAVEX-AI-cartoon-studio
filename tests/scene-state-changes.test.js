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
  assert.deepEqual(changes[0].map(change => change.value), ['inside:cave']);
  assert.deepEqual(changes[1].map(change => [change.previousValue, change.value]), [
    ['inside:cave', 'outside:cave']
  ]);
});

test('does not infer a state change without a known named actor and explicit action', () => {
  assert.deepEqual(inferStoryboardStateChanges([
    { storyDetail: 'The fox picks up the silver key.', characters: ['Foxy'] },
    { storyDetail: 'Foxy might have opened the gate.', characters: ['Foxy'] }
  ], 'en'), [[], []]);
});


test('does not attribute a later character action to an earlier-mentioned character', () => {
  const changes = inferStoryboardStateChanges([
    { storyDetail: 'Foxy smiles. Mira picks up the silver key.', characters: ['Foxy', 'Mira'] }
  ], 'en');
  assert.equal(changes[0].length, 1);
  assert.equal(changes[0][0].entityId, 'silver key');
  assert.equal(changes[0][0].actorId, 'Mira');
  assert.equal(changes[0][0].value, 'Mira');
});

test('keeps location evidence inside the sentence that names the moving character', () => {
  const changes = inferStoryboardStateChanges([
    { storyDetail: 'Foxy waves. Mira enters the stone castle.', characters: ['Foxy', 'Mira'] }
  ], 'en');
  assert.equal(changes[0].length, 1);
  assert.equal(changes[0][0].entityId, 'Mira');
  assert.equal(changes[0][0].value, 'inside:stone castle');
  assert.equal(changes[0][0].evidence, 'Mira enters the stone castle.');
});


test('tracks only explicitly named character pose changes and carries the previous pose', () => {
  const changes = inferStoryboardStateChanges([
    { storyDetail: 'Foxy sits on the stone.', characters: ['Foxy'] },
    { storyDetail: 'Foxy stands up.', characters: ['Foxy'] },
    { storyDetail: 'Foxy kneels before the gate.', characters: ['Foxy'] },
    { storyDetail: 'Foxy lies down.', characters: ['Foxy'] }
  ], 'en');
  assert.deepEqual(changes.map(scene => scene.map(change => [change.property, change.previousValue, change.value])), [
    [['pose', null, 'sitting']],
    [['pose', 'sitting', 'standing']],
    [['pose', 'standing', 'kneeling']],
    [['pose', 'kneeling', 'lying']]
  ]);
});

test('recognizes explicit Russian and Ukrainian pose changes without guessing pronouns', () => {
  const ru = inferStoryboardStateChanges([
    { storyDetail: 'Лисёнок садится на камень.', characters: ['Лисёнок'] },
    { storyDetail: 'Лисёнок встаёт.', characters: ['Лисёнок'] }
  ], 'ru');
  const uk = inferStoryboardStateChanges([
    { storyDetail: 'Лисеня сідає на камінь.', characters: ['Лисеня'] },
    { storyDetail: 'Лисеня стає на коліна.', characters: ['Лисеня'] }
  ], 'uk');
  assert.deepEqual(ru.map(scene => scene[0]?.value), ['sitting', 'standing']);
  assert.deepEqual(uk.map(scene => scene[0]?.value), ['sitting', 'kneeling']);
  assert.deepEqual(inferStoryboardStateChanges([
    { storyDetail: 'He sits on the stone.', characters: ['Foxy'] }
  ], 'en'), [[]]);
});

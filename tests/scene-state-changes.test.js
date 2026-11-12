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


test('tracks an explicit push action as a rolling prop in Russian and English', () => {
  const ru = inferStoryboardStateChanges([
    { storyDetail: 'Foxy толкает красный мяч лапой.', characters: ['Foxy'] }
  ], 'ru');
  const en = inferStoryboardStateChanges([
    { storyDetail: 'Foxy pushes the red ball.', characters: ['Foxy'] }
  ], 'en');
  assert.equal(ru[0][0].entityId, 'красный мяч лапой');
  assert.equal(ru[0][0].property, 'motion');
  assert.equal(ru[0][0].value, 'rolling');
  assert.equal(en[0][0].entityId, 'red ball');
  assert.equal(en[0][0].property, 'motion');
  assert.equal(en[0][0].value, 'rolling');
});

test('recognizes a Russian object named before the push verb when the phrase after it names the paw', () => {
  const changes = inferStoryboardStateChanges([
    { storyDetail: 'Foxy стоит на лесной тропинке, замечает красный мяч у дерева, подбегает к нему, толкает лапой, мяч катится.', characters: ['Foxy'] }
  ], 'ru');
  assert.equal(changes[0][0].entityId, 'красный мяч');
  assert.equal(changes[0][0].property, 'motion');
  assert.equal(changes[0][0].value, 'rolling');
});

test('treats Ukrainian kopaye as rolling only when the explicit object is a ball', () => {
  const ball = inferStoryboardStateChanges([
    { storyDetail: "Foxy копає червоний м'яч.", characters: ['Foxy'] }
  ], 'uk');
  const pit = inferStoryboardStateChanges([
    { storyDetail: 'Foxy копає яму.', characters: ['Foxy'] }
  ], 'uk');
  assert.equal(ball[0][0].entityId, "червоний м'яч");
  assert.equal(ball[0][0].property, 'motion');
  assert.equal(ball[0][0].value, 'rolling');
  assert.deepEqual(pit, [[]]);
});

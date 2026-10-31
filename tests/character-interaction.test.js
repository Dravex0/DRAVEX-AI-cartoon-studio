import test from 'node:test';
import assert from 'node:assert/strict';
import { inferCharacterInteraction, inferCharacterInteractions } from '../src/character-interaction.js';

test('extracts actor and target from explicit English help and guidance', () => {
  assert.deepEqual(
    inferCharacterInteraction('Bird guides Foxy home.', ['Foxy', 'Bird'], 'en'),
    { type: 'guide', actorId: 'Bird', targetId: 'Foxy', evidence: 'Bird guides Foxy' }
  );
});

test('extracts Russian directed help without reversing participants', () => {
  const result = inferCharacterInteraction('Сова помогает Мико найти дорогу.', ['Мико', 'Сова'], 'ru');
  assert.equal(result.type, 'help');
  assert.equal(result.actorId, 'Сова');
  assert.equal(result.targetId, 'Мико');
});

test('extracts Ukrainian and Spanish interactions', () => {
  const uk = inferCharacterInteraction('Сова допомагає Мико знайти шлях.', ['Сова', 'Мико'], 'uk');
  const es = inferCharacterInteraction('El ave guía al zorro a casa.', ['ave', 'zorro'], 'es');
  assert.equal(uk?.type, 'help');
  assert.equal(uk?.actorId, 'Сова');
  assert.equal(es?.type, 'guide');
  assert.equal(es?.actorId, 'ave');
  assert.equal(es?.targetId, 'zorro');
});

test('does not invent a relationship when a participant is missing or ambiguous', () => {
  assert.equal(inferCharacterInteraction('Bird helps the lost fox.', ['Bird', 'Foxy'], 'en'), null);
  assert.equal(inferCharacterInteraction('Bird sees Foxy.', ['Bird', 'Foxy'], 'en'), null);
  assert.equal(inferCharacterInteraction('Bird helps Bird.', ['Bird', 'Foxy'], 'en'), null);
});

test('ignores regex metacharacters in saved character IDs', () => {
  const result = inferCharacterInteraction('A+B helps Foxy.', ['A+B', 'Foxy'], 'en');
  assert.equal(result?.actorId, 'A+B');
});

test('uses the earliest directed action in source order instead of relation-table priority', () => {
  const result = inferCharacterInteraction(
    'Foxy attacks Bird. Snowball rescues Foxy.',
    ['Foxy', 'Bird', 'Snowball'],
    'en'
  );
  assert.equal(result?.type, 'attack');
  assert.equal(result?.actorId, 'Foxy');
  assert.equal(result?.targetId, 'Bird');
});

test('deduplicates character IDs case-insensitively before resolving participants', () => {
  const result = inferCharacterInteraction('Foxy helps Bird.', ['Foxy', 'foxy', 'Bird'], 'en');
  assert.equal(result?.type, 'help');
  assert.equal(result?.actorId, 'Foxy');
  assert.equal(result?.targetId, 'Bird');
});


test('does not borrow an interaction target from a later sentence', () => {
  const result = inferCharacterInteraction(
    'Foxy notices a shadow. Mira helps. Snowball arrives.',
    ['Foxy', 'Mira', 'Snowball'],
    'en'
  );
  assert.equal(result, null);
});

test('keeps multiple directed interactions within their own sentences', () => {
  const results = inferCharacterInteractions(
    'Foxy helps Bird. Snowball rescues Mira.',
    ['Foxy', 'Bird', 'Snowball', 'Mira'],
    'en'
  );
  assert.deepEqual(results.map(({ actorId, targetId, type }) => ({ actorId, targetId, type })), [
    { actorId: 'Foxy', targetId: 'Bird', type: 'help' },
    { actorId: 'Snowball', targetId: 'Mira', type: 'rescue' }
  ]);
});

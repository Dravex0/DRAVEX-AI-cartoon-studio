import test from 'node:test';
import assert from 'node:assert/strict';
import { inferCharacterInteraction, inferCharacterInteractions } from '../src/character-interaction.js';

test('extracts multiple directed interactions in source order without inventing timestamps', () => {
  const source = 'Foxy attacks Bird. Snowball rescues Foxy.';
  const events = inferCharacterInteractions(source, ['Foxy', 'Bird', 'Snowball'], 'en');
  assert.deepEqual(events.map(({ type, actorId, targetId }) => ({ type, actorId, targetId })), [
    { type: 'attack', actorId: 'Foxy', targetId: 'Bird' },
    { type: 'rescue', actorId: 'Snowball', targetId: 'Foxy' }
  ]);
  assert.ok(events[0].sourceStart < events[1].sourceStart);
  assert.equal(typeof events[0].sourceStart, 'number');
  assert.equal('startSeconds' in events[0], false);
  assert.equal('endSeconds' in events[0], false);
});

test('keeps the legacy singular API backward compatible', () => {
  assert.deepEqual(
    inferCharacterInteraction('Foxy attacks Bird. Snowball rescues Foxy.', ['Foxy', 'Bird', 'Snowball'], 'en'),
    { type: 'attack', actorId: 'Foxy', targetId: 'Bird', evidence: 'Foxy attacks Bird' }
  );
});

test('returns no event when participant attribution is ambiguous or incomplete', () => {
  assert.deepEqual(inferCharacterInteractions('Bird helps the lost fox.', ['Bird', 'Foxy'], 'en'), []);
  assert.deepEqual(inferCharacterInteractions('Bird helps Bird.', ['Bird', 'Foxy'], 'en'), []);
});

test('supports multiple explicit Russian interactions', () => {
  const events = inferCharacterInteractions('Сова помогает Мико. Мико спасает Сову.', ['Сова', 'Мико'], 'ru');
  assert.deepEqual(events.map(({ type, actorId, targetId }) => [type, actorId, targetId]), [
    ['help', 'Сова', 'Мико'],
    ['rescue', 'Мико', 'Сова']
  ]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { inferSceneCast } from '../src/scene-cast-inference.js';

test('assigns every saved character explicitly named in the source event', () => {
  assert.deepEqual(
    inferSceneCast('A glowing Bird guides Foxy home.', ['Foxy', 'Bird', 'Wolf'], 'Foxy'),
    ['Foxy', 'Bird']
  );
});

test('matches Unicode names and multi-word character IDs', () => {
  assert.deepEqual(
    inferSceneCast('Робот Мико и Сова идут вместе.', ['Робот Мико', 'Сова'], 'Робот Мико'),
    ['Робот Мико', 'Сова']
  );
});

test('does not match a character name as a substring of another word', () => {
  assert.deepEqual(inferSceneCast('The bird flies over the forest.', ['Birdman'], 'Foxy'), ['Foxy']);
});

test('falls back to the protagonist when no known character is named', () => {
  assert.deepEqual(inferSceneCast('A storm blocks the mountain pass.', ['Foxy', 'Bird'], 'Foxy'), ['Foxy']);
});

test('deduplicates case-insensitively and caps the cast at twelve', () => {
  const names = Array.from({ length: 14 }, (_, index) => 'Hero' + index);
  const story = names.join(' ');
  const result = inferSceneCast(story, [...names, 'hero0'], 'Main');
  assert.equal(result.length, 12);
  assert.equal(new Set(result.map(name => name.toLowerCase())).size, 12);
});

test('ignores empty and non-string character IDs safely', () => {
  assert.deepEqual(inferSceneCast('No known name appears here.', [null, '', 42], ''), []);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStoryboardFromText, STORYBOARD_BEAT_COUNT } from '../src/storyboard-generator.js';

test('creates five beats with distinct actions and camera plans', () => {
  const result = buildStoryboardFromText(
    'A fox finds a glowing key. It opens an old gate. A shadow blocks the path. The fox raises the key and light fills the forest. The gate opens and birds return.',
    'en',
    'Foxy'
  );
  assert.equal(result.titles.length, STORYBOARD_BEAT_COUNT);
  assert.equal(result.scenes.length, STORYBOARD_BEAT_COUNT);
  assert.equal(new Set(result.scenes.map((scene) => scene.visibleAction)).size, STORYBOARD_BEAT_COUNT);
  assert.equal(new Set(result.scenes.map((scene) => scene.camera)).size, STORYBOARD_BEAT_COUNT);
});

test('preserves each source sentence exactly once instead of repeating one sentence in every scene', () => {
  const idea = 'A fox finds a silver key. The forest becomes dark. A small bird calls for help.';
  const result = buildStoryboardFromText(idea, 'ru', 'Лисёнок');
  const assigned = result.scenes.map((scene) => scene.storyDetail).filter(Boolean);
  assert.equal(assigned.length, 3);
  assert.equal(assigned.join(' '), idea);
  for (const sentence of ['A fox finds a silver key.', 'The forest becomes dark.', 'A small bird calls for help.']) {
    assert.equal(result.descriptions.join(' ').split(sentence).length - 1, 1);
  }
});

test('one-sentence premise is used once and later beats remain distinct editable scaffolding', () => {
  const result = buildStoryboardFromText('A little dragon wants to find its family.', 'en', 'Pip');
  assert.equal(result.scenes.filter((scene) => scene.storyDetail).length, 1);
  assert.equal(result.descriptions.join(' ').split('A little dragon wants to find its family.').length - 1, 1);
  assert.equal(new Set(result.scenes.map((scene) => scene.visibleAction)).size, 5);
});

test('handles empty ideas with a localized fallback', () => {
  const result = buildStoryboardFromText('   ', 'ru', '');
  assert.equal(result.scenes.length, 5);
  assert.match(result.descriptions[0], /Начинается новое приключение/);
});

test('unknown language falls back to English and long input is bounded', () => {
  const result = buildStoryboardFromText('A'.repeat(20_000), 'fr', 'Hero');
  assert.equal(result.scenes.length, 5);
  assert.ok(result.scenes.every((scene) => scene.description.length < 2_000));
});

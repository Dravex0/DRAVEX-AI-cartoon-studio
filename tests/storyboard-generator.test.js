import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStoryboardFromText, STORYBOARD_BEAT_COUNT } from '../src/storyboard-generator.js';

test('creates five beats with distinct actions and camera plans', () => {
  const result = buildStoryboardFromText('A fox finds a glowing key. It opens an old gate. A shadow blocks the path. The fox raises the key and light fills the forest. The gate opens and birds return.', 'en', 'Foxy');
  assert.equal(result.titles.length, STORYBOARD_BEAT_COUNT);
  assert.equal(result.scenes.length, STORYBOARD_BEAT_COUNT);
  assert.equal(new Set(result.scenes.map(scene => scene.visibleAction)).size, STORYBOARD_BEAT_COUNT);
  assert.equal(new Set(result.scenes.map(scene => scene.camera)).size, STORYBOARD_BEAT_COUNT);
  assert.equal(result.eventChain.sceneCount, STORYBOARD_BEAT_COUNT);
  assert.equal(result.eventChain.nodes.length, STORYBOARD_BEAT_COUNT);
  assert.ok(result.eventChain.nodes.every(node => node.sceneId && node.sourceEvidence !== undefined));
});

test('preserves each source sentence exactly once instead of repeating one sentence in every scene', () => {
  const idea = 'A fox finds a silver key. The forest becomes dark. A small bird calls for help.';
  const result = buildStoryboardFromText(idea, 'ru', 'Лисёнок');
  const assigned = result.scenes.map(scene => scene.storyDetail).filter(Boolean);
  assert.equal(assigned.length, 3);
  assert.equal(assigned.join(' '), idea);
  for (const sentence of ['A fox finds a silver key.', 'The forest becomes dark.', 'A small bird calls for help.']) {
    assert.equal(result.descriptions.join(' ').split(sentence).length - 1, 1);
  }
});

test('one-sentence premise is used once and later beats remain distinct editable scaffolding', () => {
  const result = buildStoryboardFromText('A little dragon wants to find its family.', 'en', 'Pip');
  assert.equal(result.scenes.filter(scene => scene.storyDetail).length, 1);
  assert.equal(result.descriptions.join(' ').split('A little dragon wants to find its family.').length - 1, 1);
  assert.equal(new Set(result.scenes.map(scene => scene.visibleAction)).size, 5);
});

test('preserves explicit production directions as metadata for every local scene', () => {
  const result = buildStoryboardFromText('Стиль: акварель\nНе добавлять: новых персонажей\nЛисёнок находит ключ. Ключ открывает ворота.', 'ru', 'Лисёнок');
  assert.equal(result.brief.directives.style, 'акварель');
  assert.equal(result.scenes[0].productionDirectives.avoid, 'новых персонажей');
  assert.match(result.scenes[0].prompt, /акварель/);
  assert.equal(result.scenes[0].sourceStoryText, 'Лисёнок находит ключ. Ключ открывает ворота.');
});

test('handles empty ideas with a localized fallback', () => {
  const result = buildStoryboardFromText('   ', 'ru', '');
  assert.equal(result.scenes.length, 5);
  assert.match(result.descriptions[0], /Начинается новое приключение/);
});

test('unknown language falls back to English and long input is bounded', () => {
  const result = buildStoryboardFromText('A'.repeat(20_000), 'fr', 'Hero');
  assert.equal(result.scenes.length, 5);
  assert.ok(result.scenes.every(scene => scene.description.length < 2_000));
});


test('honors requested scene counts from 3 through 8 with distinct action and camera plans', () => {
  for (const count of [3, 4, 5, 6, 7, 8]) {
    const result = buildStoryboardFromText(
      `Количество сцен: ${count}\nЛисёнок находит ключ. Ворота закрыты. Появляется сова. Лисёнок меняет план. Ключ начинает светиться.`,
      'ru',
      'Лисёнок'
    );
    assert.equal(result.scenes.length, count, `expected ${count} scenes`);
    assert.equal(result.requestedSceneCount, count);
    assert.equal(new Set(result.scenes.map(scene => scene.visibleAction)).size, count);
    assert.equal(new Set(result.scenes.map(scene => scene.camera)).size, count);
  }
});

test('keeps the five-scene default when no scene count is requested', () => {
  const result = buildStoryboardFromText('A fox finds a lantern.', 'en', 'Foxy');
  assert.equal(result.scenes.length, 5);
  assert.equal(result.requestedSceneCount, 5);
});

test('preserves source story details exactly once when the requested scene count changes', () => {
  const idea = 'Количество сцен: 7\nЛисёнок находит ключ. В лесу гаснет свет. Сова показывает путь.';
  const result = buildStoryboardFromText(idea, 'ru', 'Лисёнок');
  const details = result.scenes.map(scene => scene.storyDetail).filter(Boolean);
  assert.equal(details.join(' '), 'Лисёнок находит ключ. В лесу гаснет свет. Сова показывает путь.');
  for (const sentence of ['Лисёнок находит ключ.', 'В лесу гаснет свет.', 'Сова показывает путь.']) {
    assert.equal(result.descriptions.join(' ').split(sentence).length - 1, 1);
  }
});

test('story-specific source events drive different visible actions and camera plans', () => {
  const result = buildStoryboardFromText(
    'A fox finds a silver key. The forest becomes dark. A small bird guides Foxy home.',
    'en',
    'Foxy'
  );
  assert.equal(result.scenes[0].storyEventType, 'discovery');
  assert.equal(result.scenes[1].storyEventType, 'transformation');
  assert.equal(result.scenes[3].storyEventType, 'guidance_help');
  assert.match(result.scenes[0].visibleAction, /noticing an important object/);
  assert.match(result.scenes[1].visibleAction, /gradual change/);
  assert.match(result.scenes[3].visibleAction, /following the guidance/);
  assert.notEqual(result.scenes[0].camera, result.scenes[1].camera);
  assert.notEqual(result.scenes[1].camera, result.scenes[3].camera);
});

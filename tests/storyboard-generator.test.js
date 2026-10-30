import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStoryboardFromText, inferSceneEmotion, STORYBOARD_BEAT_COUNT } from '../src/storyboard-generator.js';

test('creates five beats with distinct actions and camera plans by default', () => {
  const result = buildStoryboardFromText('A fox finds a glowing key. It opens an old gate. A shadow blocks the path. The fox raises the key and light fills the forest. The gate opens and birds return.', 'en', 'Foxy');
  assert.equal(result.titles.length, STORYBOARD_BEAT_COUNT);
  assert.equal(result.scenes.length, STORYBOARD_BEAT_COUNT);
  assert.equal(new Set(result.scenes.map(scene => scene.camera)).size, STORYBOARD_BEAT_COUNT);
});

test('preserves each source sentence exactly once instead of repeating one sentence in every scene', () => {
  const idea = 'A fox finds a silver key. The forest becomes dark. A small bird calls for help.';
  const result = buildStoryboardFromText(idea, 'ru', 'Лисёнок');
  const assigned = result.scenes.map(scene => scene.storyDetail).filter(Boolean);
  assert.equal(assigned.join(' '), idea);
  for (const sentence of ['A fox finds a silver key.', 'The forest becomes dark.', 'A small bird calls for help.']) {
    assert.equal(result.descriptions.join(' ').split(sentence).length - 1, 1);
  }
});

test('one-sentence premise is used once and later beats remain distinct editable scaffolding', () => {
  const result = buildStoryboardFromText('A little dragon wants to find its family.', 'en', 'Pip');
  assert.equal(result.scenes.filter(scene => scene.storyDetail).length, 1);
  assert.equal(result.descriptions.join(' ').split('A little dragon wants to find its family.').length - 1, 1);
  assert.equal(new Set(result.scenes.map(scene => scene.camera)).size, STORYBOARD_BEAT_COUNT);
});

test('preserves explicit production directions as metadata for every local scene', () => {
  const result = buildStoryboardFromText('Стиль: акварель\nЖанр: приключение\nНастроение: волшебное\nКоличество сцен: 6\nНе добавлять: новых персонажей\nЛисёнок находит ключ. Ключ открывает ворота.', 'ru', 'Лисёнок');
  assert.equal(result.brief.directives.style, 'акварель');
  assert.equal(result.scenes[0].productionDirectives.avoid, 'новых персонажей');
  assert.match(result.scenes[0].imagePrompt, /акварель/);
  assert.match(result.scenes[0].imagePrompt, /Genre: приключение/);
  assert.match(result.scenes[0].motionPrompt, /Mood: волшебное/);
  assert.equal(result.scenes[0].sourceStoryText, result.brief.storyText);
});

test('uses explicit numbered scenes and creates the requested number of scene cards', () => {
  const idea = [
    'Лисёнок и волшебный кристалл.',
    'Жанр: приключение, фэнтези.',
    'Стиль: акварель · Количество сцен: 6 · Не добавлять: новых героев.',
    'Сцена 1. Таинственный лес',
    'Рыжик гуляет по волшебному лесу.',
    'Сцена 2. Неожиданная находка',
    'Рыжик замечает голубой кристалл.',
    'Сцена 3. Новый друг',
    'Снежок выбегает из-за дерева. Рыжик смотрит на него.',
    'Сцена 4. Волшебство',
    'Кристалл начинает светиться. Друзья удивляются.',
    'Сцена 5. Опасность',
    'Лес окутывает тёмный туман. Снежок прячется за Рыжиком.',
    'Сцена 6. Счастливый финал',
    'Рыжик и Снежок вместе спасают лес.'
  ].join('\n');
  const result = buildStoryboardFromText(idea, 'ru', 'Foxy');
  assert.equal(result.scenes.length, 6);
  assert.deepEqual(result.titles, ['Таинственный лес', 'Неожиданная находка', 'Новый друг', 'Волшебство', 'Опасность', 'Счастливый финал']);
  assert.match(result.scenes[0].imagePrompt, /Рыжик гуляет/);
  assert.match(result.scenes[0].motionPrompt, /Рыжик гуляет/);
  assert.ok(result.scenes.every(scene => scene.camera && scene.startState && scene.endState && scene.continuityLock));
  assert.equal(result.scenes[0].productionDirectives.style, 'акварель');
  assert.equal(result.scenes[0].productionDirectives.sceneCount, '6');
  assert.equal(result.scenes[0].productionDirectives.avoid, 'новых героев.');
});

test('extracts character descriptions and assigns only mentioned characters to scenes', () => {
  const idea = [
    'Главные герои:',
    'Рыжик — маленький рыжий лисёнок с белой мордочкой.',
    'Снежок — маленький белый кролик с длинными ушами.',
    '',
    'Сцена 1. Лес',
    'Рыжик гуляет по лесу.',
    'Сцена 2. Встреча',
    'Рыжик встречает Снежка.'
  ].join('\n');
  const result = buildStoryboardFromText(idea, 'ru', 'Foxy');
  assert.deepEqual(result.characterBible.map(item => item.characterId), ['Рыжик', 'Снежок']);
  assert.deepEqual(result.scenes[0].characters, ['Рыжик']);
  assert.deepEqual(result.scenes[1].characters, ['Рыжик', 'Снежок']);
  assert.equal(result.mainCharacter, 'Рыжик');
  assert.match(result.scenes[1].continuityLock, /белый кролик/);
});

test('automatically prepares all production fields for each scene', () => {
  const result = buildStoryboardFromText('Сцена 1. Старт\nЛисёнок выходит на поляну.\nСцена 2. Финал\nЛисёнок находит кристалл.', 'ru', 'Лисёнок');
  for (const scene of result.scenes) {
    assert.ok(scene.imagePrompt.length > 0);
    assert.ok(scene.motionPrompt.length > 0);
    assert.ok(scene.camera.length > 0);
    assert.ok(scene.startState.length > 0);
    assert.ok(scene.endState.length > 0);
    assert.ok(scene.negativePrompt.length > 0);
    assert.ok(scene.continuityLock.length > 0);
  }
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


test('builds a cast automatically from natural character introductions', () => {
  const idea = [
    'Сцена 1. Лес',
    'Маленький рыжий лисёнок по имени Рыжик гуляет по лесу.',
    'Сцена 2. Встреча',
    'Из-за дерева выбегает маленький белый кролик по имени Снежок. Рыжик встречает Снежка.'
  ].join('\n');
  const result = buildStoryboardFromText(idea, 'ru', 'Foxy');
  assert.equal(result.mainCharacter, 'Рыжик');
  assert.deepEqual(result.characterBible.map(item => item.characterId), ['Рыжик', 'Снежок']);
  assert.deepEqual(result.scenes[1].characters, ['Рыжик', 'Снежок']);
});


test('infers a face-to-face interaction from dialogue in a two-character scene', () => {
  const idea = [
    'Сцена 1. Встреча',
    'Маленький рыжий лисёнок по имени Рыжик встречает маленького белого кролика по имени Снежок. Снежок говорит: «Не трогай кристалл!»'
  ].join('\n');
  const result = buildStoryboardFromText(idea, 'ru', 'Foxy');
  assert.deepEqual(result.scenes[0].characters, ['Рыжик', 'Снежок']);
  assert.equal(result.scenes[0].interactions[0].type, 'talk_to');
  assert.deepEqual(result.scenes[0].interactions[0].participants, ['Рыжик', 'Снежок']);
});

test('infers approach movement only when the story describes approaching', () => {
  const idea = [
    'Сцена 1. Встреча',
    'Маленький рыжий лисёнок по имени Рыжик подходит к маленькому белому кролику по имени Снежок и осторожно останавливается рядом.'
  ].join('\n');
  const result = buildStoryboardFromText(idea, 'ru', 'Foxy');
  assert.equal(result.scenes[0].interactions[0].type, 'approach');
});

test('does not invent multi-character interactions in a single-character scene', () => {
  const result = buildStoryboardFromText('Сцена 1. Лес\nРыжик гуляет по лесу.', 'ru', 'Foxy');
  assert.deepEqual(result.scenes[0].interactions, []);
});


test('infers a visible object hand-off only when the story names the object explicitly', () => {
  const idea = [
    'Сцена 1. Передача ключа',
    'Маленький рыжий лисёнок по имени Рыжик передаёт маленькому белому кролику по имени Снежок «серебряный ключ». Снежок принимает его.'
  ].join('\n');
  const result = buildStoryboardFromText(idea, 'ru', 'Foxy');
  assert.equal(result.scenes[0].interactions[0].type, 'give_object');
  assert.equal(result.scenes[0].interactions[0].objectDescription, 'серебряный ключ');
  assert.deepEqual(result.scenes[0].interactions[0].participants, ['Рыжик', 'Снежок']);
});

test('does not invent a prop description for an unlabelled hand-off', () => {
  const idea = 'Сцена 1. Передача\nМаленький рыжий лисёнок по имени Рыжик встречает маленького белого кролика по имени Снежок и передаёт ему что-то.';
  const result = buildStoryboardFromText(idea, 'ru', 'Foxy');
  assert.equal(result.scenes[0].interactions[0].type, 'give_object');
  assert.equal(result.scenes[0].interactions[0].objectDescription, undefined);
});


test('infers explicit scene emotions across Russian, Ukrainian, English and Spanish', () => {
  assert.equal(inferSceneEmotion('Рыжик счастлив и улыбается.'), 'happy');
  assert.equal(inferSceneEmotion('Снежок боится громкого звука.'), 'fear');
  assert.equal(inferSceneEmotion('Герой плачет от грусти.'), 'sad');
  assert.equal(inferSceneEmotion('The fox is furious and angry.'), 'anger');
  assert.equal(inferSceneEmotion('El conejo está sorprendido.'), 'surprised');
  assert.equal(inferSceneEmotion('Герой спокойно идёт по лесу.'), 'neutral');
});

test('stores inferred emotion on each scene without changing neutral scenes', () => {
  const result = buildStoryboardFromText('Сцена 1. Радость\nРыжик счастлив и смеётся.\nСцена 2. Лес\nРыжик гуляет по лесу.', 'ru', 'Рыжик');
  assert.equal(result.scenes[0].emotion, 'happy');
  assert.equal(result.scenes[1].emotion, 'neutral');
});

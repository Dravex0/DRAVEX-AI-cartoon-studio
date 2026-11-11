import test from 'node:test';
import assert from 'node:assert/strict';
import { formatProductionDirectives, parseStoryBrief } from '../src/story-brief.js';

test('separates Russian production directions from narrative without losing either', () => {
  const brief = parseStoryBrief('Стиль: 3D Pixar-like, мягкий свет\nКоличество сцен: 6\nГолос: тёплый женский\nЛисёнок находит ключ. Он открывает старую дверь.');
  assert.equal(brief.storyText, 'Лисёнок находит ключ. Он открывает старую дверь.');
  assert.equal(brief.directives.style, '3D Pixar-like, мягкий свет');
  assert.equal(brief.directives.voice, 'тёплый женский');
  assert.equal(brief.requestedSceneCount, 6);
  assert.equal(brief.keyEvents.length, 2);
  assert.match(brief.rawText, /Количество сцен: 6/);
});

test('recognizes Ukrainian and English labels', () => {
  const brief = parseStoryBrief('Візуальний стиль: акварель\nНе додавати: нових персонажів\nA girl finds a tiny dragon.');
  assert.equal(brief.directives.style, 'акварель');
  assert.equal(brief.directives.avoid, 'нових персонажів');
  assert.equal(brief.storyText, 'A girl finds a tiny dragon.');
});

test('keeps plain narrative intact when there are no recognized directions', () => {
  const text = 'A fox runs through the forest: the wind follows him. Then he stops.';
  const brief = parseStoryBrief(text);
  assert.equal(brief.storyText, text);
  assert.deepEqual(brief.directives, {});
});

test('formats directives for downstream AI prompts', () => {
  assert.match(formatProductionDirectives({ style: 'watercolor', avoid: 'extra characters' }), /style: watercolor/);
});

test('parses explicit scene duration in seconds and clamps it to the supported range', () => {
  assert.equal(parseStoryBrief('Длительность: 5 секунд\nA fox finds a key.').requestedDurationSeconds, 5);
  assert.equal(parseStoryBrief('Duration: 1.5 sec\nA fox finds a key.').requestedDurationSeconds, 1.5);
  assert.equal(parseStoryBrief('Длительность: 90 секунд\nA fox finds a key.').requestedDurationSeconds, 30);
  assert.equal(parseStoryBrief('Duration: cinematic\nA fox finds a key.').requestedDurationSeconds, null);
});


test('recognizes explicit main character labels in English, Russian and Ukrainian', () => {
  assert.deepEqual(parseStoryBrief('Main character: Arin\nA young guardian protects the city.').characters, ['Arin']);
  assert.deepEqual(parseStoryBrief('Главный персонаж: Арин\nАрин защищает город.').characters, ['Арин']);
  assert.deepEqual(parseStoryBrief('Головний герой: Арін\nАрін захищає місто.').characters, ['Арін']);
});


test('parses an inline main-character profile without treating its description as the character name', () => {
  const brief = parseStoryBrief([
    'Main character: Foxy — a small orange fox with large expressive eyes.',
    'Stage the story event as one visible cause-and-effect action; preserve the named character and show a clear state change.'
  ].join('\n'));
  assert.deepEqual(brief.characters, ['Foxy']);
  assert.equal(brief.characterProfiles[0].characterId, 'Foxy');
  assert.match(brief.characterProfiles[0].visualDescription, /small orange fox/i);
  assert.equal(brief.storyText, '');
  assert.match(brief.directives.productionNotes, /Stage the story event/);
});

test('normalizes a standalone main-character label before narrative on the next line', () => {
  const brief = parseStoryBrief('Main character: Foxy.\\nFoxy finds a red ball.');
  assert.deepEqual(brief.characters, ['Foxy']);
  assert.equal(brief.storyText, 'Foxy finds a red ball.');
});

test('separates a short main-character label and same-line production prose from the story', () => {
  const brief = parseStoryBrief('Main character: Foxy. Stage one clear action.\nFoxy finds a glowing crystal.');
  assert.deepEqual(brief.characters, ['Foxy']);
  assert.equal(brief.storyText, 'Foxy finds a glowing crystal.');
  assert.equal(brief.directives.productionNotes, 'Stage one clear action.');
});


test('routes free-form production directions to metadata and keeps labeled story detail as narrative', () => {
  const brief = parseStoryBrief([
    'Main character: Foxy.',
    'Stage the story event as one visible cause-and-effect action; preserve its named participants and objects, and show a clear state change.',
    'Keep Foxy involved when the story calls for it.',
    'Medium shot with a clear view of the acting character, the important object, and the result.',
    'Story detail to preserve: Foxy finds a red ball under a tree and pushes it with his paw.'
  ].join('\n'));
  assert.equal(brief.storyText, 'Foxy finds a red ball under a tree and pushes it with his paw.');
  assert.doesNotMatch(brief.storyText, /Stage the story event|Keep Foxy|Medium shot/i);
  assert.match(brief.directives.productionNotes, /Stage the story event/);
  assert.match(brief.directives.productionNotes, /Keep Foxy involved/);
  assert.match(brief.directives.productionNotes, /Medium shot/);
  assert.equal(brief.keyEvents.length, 1);
});

test('separates a semicolon-delimited production direction from the preceding story event', () => {
  const brief = parseStoryBrief('Foxy finds a red ball under a tree; Keep Foxy visible in every scene.');
  assert.equal(brief.storyText, 'Foxy finds a red ball under a tree;');
  assert.match(brief.directives.productionNotes, /Keep Foxy visible in every scene/);
  assert.equal(brief.keyEvents.length, 1);
});

test('keeps inline character appearance separate from trailing production directions and story detail', () => {
  const brief = parseStoryBrief(
    'Main character: Foxy — a small orange fox with large expressive eyes. Keep Foxy visible in every scene. Story detail to preserve: Foxy pushes a red ball.'
  );
  assert.deepEqual(brief.characters, ['Foxy']);
  assert.equal(brief.characterProfiles[0].visualDescription, 'a small orange fox with large expressive eyes.');
  assert.equal(brief.storyText, 'Foxy pushes a red ball.');
  assert.match(brief.directives.productionNotes, /Keep Foxy visible/);
});

test('does not fall back to raw production-only text as a story', () => {
  const brief = parseStoryBrief('Main character: Foxy. Keep Foxy visible in every scene. Medium shot.');
  assert.equal(brief.storyText, '');
  assert.match(brief.directives.productionNotes, /Keep Foxy visible/);
});

test('extracts character profiles from bullet and comma-separated character descriptions', () => {
  const brief = parseStoryBrief([
    'Characters:',
    '- Arin, 17 years old, black hair and blue energy.',
    '- Elira, 17 years old, silver hair and light magic.',
    '- Nox, tall antagonist in black armor.',
    'Scene 1: The Falling Stars',
    'Arin stands on a rooftop.'
  ].join('\n'));
  assert.deepEqual(brief.characterProfiles.map(profile => profile.characterId), ['Arin', 'Elira', 'Nox']);
  assert.deepEqual(brief.characters.slice(0, 3), ['Arin', 'Elira', 'Nox']);
});

test('extracts visually described generic characters from a natural-language prompt', () => {
  const brief = parseStoryBrief('A small blue robot walks through a park, meets a little red bird, waves, and they become friends. Duration: 0.25 seconds.');
  assert.deepEqual(brief.characters, ['small blue robot', 'little red bird']);
  assert.equal(brief.characterProfiles[0].visualDescription, 'small blue robot');
  assert.equal(brief.characterProfiles[1].visualDescription, 'little red bird');
});

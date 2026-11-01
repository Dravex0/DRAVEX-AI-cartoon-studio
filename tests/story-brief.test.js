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
  assert.deepEqual(parseStoryBrief('Main character: Arin\\nA young guardian protects the city.').characters, ['Arin']);
  assert.deepEqual(parseStoryBrief('Главный персонаж: Арин\\nАрин защищает город.').characters, ['Арин']);
  assert.deepEqual(parseStoryBrief('Головний герой: Арін\\nАрін захищає місто.').characters, ['Арін']);
});

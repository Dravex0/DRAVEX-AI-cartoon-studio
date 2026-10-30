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

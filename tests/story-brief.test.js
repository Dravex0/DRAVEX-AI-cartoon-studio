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

test('parses compact production directions separated by middle dots', () => {
  const brief = parseStoryBrief('Стиль: акварель · Количество сцен: 6 · Не добавлять: новых героев.');
  assert.equal(brief.directives.style, 'акварель');
  assert.equal(brief.directives.sceneCount, '6');
  assert.equal(brief.directives.avoid, 'новых героев.');
  assert.equal(brief.requestedSceneCount, 6);
});

test('parses numbered scene headings as separate blocks', () => {
  const brief = parseStoryBrief('Сцена 1. Лес\nРыжик гуляет.\nСцена 2. Встреча\nСнежок появляется.');
  assert.equal(brief.sceneBlocks.length, 2);
  assert.equal(brief.sceneBlocks[0].title, 'Лес');
  assert.equal(brief.sceneBlocks[0].text, 'Рыжик гуляет.');
  assert.equal(brief.sceneBlocks[1].title, 'Встреча');
  assert.equal(brief.sceneBlocks[1].text, 'Снежок появляется.');
});

test('extracts named character profiles from the character section', () => {
  const brief = parseStoryBrief('Главные герои:\nРыжик — маленький рыжий лисёнок.\nСнежок — белый кролик.\n\nСцена 1. Лес\nРыжик гуляет.');
  assert.deepEqual(brief.characters, ['Рыжик', 'Снежок']);
  assert.equal(brief.characterProfiles.length, 2);
  assert.match(brief.characterProfiles[1].visualDescription, /белый кролик/);
});


test('detects character names introduced naturally without a cast heading', () => {
  const brief = parseStoryBrief('Маленький рыжий лисёнок по имени Рыжик гуляет по лесу. Из-за дерева выбегает маленький белый кролик по имени Снежок.');
  assert.deepEqual(brief.characters, ['Рыжик', 'Снежок']);
  assert.match(brief.characterProfiles[0].visualDescription, /рыжий лисёнок/);
  assert.match(brief.characterProfiles[1].visualDescription, /белый кролик/);
});


test('accepts middle-dot scene heading separators', () => {
  const brief = parseStoryBrief('Scene 1 · Opening\nA fox enters the forest.\nScene 2 · Discovery\nThe fox finds a crystal.');
  assert.equal(brief.sceneBlocks.length, 2);
  assert.equal(brief.sceneBlocks[0].title, 'Opening');
  assert.equal(brief.sceneBlocks[1].title, 'Discovery');
});

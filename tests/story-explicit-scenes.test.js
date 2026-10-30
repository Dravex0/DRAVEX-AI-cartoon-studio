import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStoryBrief } from '../src/story-brief.js';
import { buildStoryboardFromText } from '../src/storyboard-generator.js';

test('parses numbered Russian scene headings and preserves their titles and text', () => {
  const brief = parseStoryBrief('Сцена 1 — Встреча\nЛисёнок входит в лес и замечает свет.\n\nСцена 2 — Находка\nЛисёнок находит серебряный ключ.\n\nСцена 3 — Ворота\nКлюч открывает старые ворота.');
  assert.equal(brief.sceneBlocks.length, 3);
  assert.deepEqual(brief.sceneBlocks.map(scene => scene.title), ['Встреча', 'Находка', 'Ворота']);
  assert.deepEqual(brief.sceneBlocks.map(scene => scene.text), [
    'Лисёнок входит в лес и замечает свет.',
    'Лисёнок находит серебряный ключ.',
    'Ключ открывает старые ворота.'
  ]);
  assert.equal(brief.requestedSceneCount, 3);
});

test('uses explicit scene blocks instead of redistributing the whole story across generic beats', () => {
  const result = buildStoryboardFromText(
    'Сцена 1 — Встреча\nЛисёнок входит в лес и замечает свет.\n\nСцена 2 — Находка\nЛисёнок находит серебряный ключ.\n\nСцена 3 — Ворота\nКлюч открывает старые ворота.',
    'ru', 'Лисёнок'
  );
  assert.equal(result.scenes.length, 3);
  assert.deepEqual(result.titles, ['Встреча', 'Находка', 'Ворота']);
  assert.deepEqual(result.scenes.map(scene => scene.storyDetail), [
    'Лисёнок входит в лес и замечает свет.',
    'Лисёнок находит серебряный ключ.',
    'Ключ открывает старые ворота.'
  ]);
  assert.equal(result.eventChain.sceneCount, 3);
});

test('keeps source-grounded causal links when explicit scene headings are used', () => {
  const result = buildStoryboardFromText(
    'Scene 1: The bridge\nThe bridge collapses.\n\nScene 2: The detour\nAs a result, the travelers take the forest path.\n\nScene 3: The arrival\nThe travelers reach the village.',
    'en', 'Foxy'
  );
  const effect = result.scenes.find(scene => scene.causalLink);
  assert.ok(effect);
  assert.equal(effect.causalLink.causeSceneId, 'scene_1');
  assert.equal(effect.causalLink.effectSceneId, effect.id);
});

test('preserves all authored text when more than eight scene headings are supplied', () => {
  const source = Array.from({ length: 9 }, (_, index) => 'Scene ' + (index + 1) + ': Part ' + (index + 1) + '\nThe character performs action ' + (index + 1) + '.').join('\n\n');
  const brief = parseStoryBrief(source);
  assert.equal(brief.sceneBlocks.length, 8);
  assert.ok(brief.issues.some(issue => issue.code === 'scene-count-limit'));
  assert.match(brief.sceneBlocks[7].text, /action 9/);
  const result = buildStoryboardFromText(source, 'en', 'Hero');
  assert.equal(result.scenes.length, 8);
  assert.match(result.scenes[7].storyDetail, /action 9/);
});

test('explicit scene headings take precedence over a conflicting scene-count directive', () => {
  const brief = parseStoryBrief('Scenes: 6\nScene 1: Start\nA fox enters.\nScene 2: Find\nA fox finds a key.\nScene 3: End\nA fox opens the gate.');
  assert.equal(brief.requestedSceneCount, 3);
  assert.ok(brief.issues.some(issue => issue.code === 'scene-count-mismatch'));
});
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('ComfyUI exposes four optional character-reference bindings for both workflow types', () => {
  for (const index of [1, 2, 3, 4]) {
    assert.ok(app.includes(`referenceImage${index}:[\'comfyReference${index}Node\',\'comfyReference${index}Input\']`));
    assert.ok(app.includes(`referenceImage${index}:[\'comfyTextReference${index}Node\',\'comfyTextReference${index}Input\']`));
    assert.ok(app.includes(`'comfyReference${index}Node','comfyReference${index}Input'`));
    assert.ok(app.includes(`'comfyTextReference${index}Node','comfyTextReference${index}Input'`));
    assert.ok(html.includes(`id="comfyReference${index}Node"`));
    assert.ok(html.includes(`id="comfyReference${index}Input"`));
    assert.ok(html.includes(`id="comfyTextReference${index}Node"`));
    assert.ok(html.includes(`id="comfyTextReference${index}Input"`));
    assert.ok(html.includes(`id="comfyCharacterReference${index}"`));
  }
});

test('all three ComfyUI generation paths preserve manual-first references without truncating them', () => {
  assert.match(app, /import \{ prioritizeCharacterReferenceImages \} from [\"']\.\/character-reference-selection\.js[\"']/);
  assert.match(app, /async function buildCharacterReferenceImagesForScene\(scene\)[\s\S]*?return prioritizeCharacterReferenceImages\(comfyCharacterReferenceFiles,profileImages,\{[\s\S]*?manualSceneId:comfyCharacterReferenceSceneId,[\s\S]*?sceneId:String\(scene\?\.id\|\|''\)/);
  assert.equal((app.match(/buildCharacterReferenceImagesForScene\(/g) || []).length, 4);
  assert.doesNotMatch(app, /profileReferences\.concat\(comfyCharacterReferenceFiles\.filter\(Boolean\)\)/);
  assert.doesNotMatch(app, /profileReferenceImages\.concat\(comfyCharacterReferenceFiles\.filter\(Boolean\)\)/);
});

test('T2V reference bindings invalidate the local ComfyUI connection when changed', () => {
  const configStart = app.indexOf('const comfyConfigurationInputIds=[');
  const configEnd = app.indexOf('];', configStart);
  assert.ok(configStart >= 0 && configEnd > configStart);
  const config = app.slice(configStart, configEnd);
  for (const index of [1, 2, 3, 4]) {
    assert.ok(config.includes(`'comfyTextReference${index}Node'`));
    assert.ok(config.includes(`'comfyTextReference${index}Input'`));
  }
});

test('universal ComfyUI generation surfaces provider warnings instead of hiding skipped references', () => {
  const start = app.indexOf('async function generateLocalSceneVideoForUniversal');
  const end = app.indexOf('function setComfyStatus', start);
  assert.ok(start >= 0 && end > start);
  const body = app.slice(start, end);
  assert.match(body, /stage==='warning'&&job\.message/);
  assert.match(body, /\$\('status'\)\.textContent=warning/);
  assert.match(body, /reportProgress\?\.\(warning\)/);
});


test('manual ComfyUI references are scoped to the scene where they were selected', () => {
  assert.match(app, /let comfyCharacterReferenceSceneId=''/);
  assert.match(app, /function clearComfyCharacterReferencesForSceneChange\\(\\)/);
  assert.match(app, /function renderScenes\\(\\)\\{\\s*clearComfyCharacterReferencesForSceneChange\\(\\)/);
  assert.match(app, /if\\(file\\)comfyCharacterReferenceSceneId=currentSceneId/);
  assert.match(html, /Manual reference uploads belong only to the currently selected scene/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('ComfyUI exposes four optional character-reference node bindings', () => {
  for (const index of [1, 2, 3, 4]) {
    assert.ok(app.includes("referenceImage" + index + ":['comfyReference" + index + "Node','comfyReference" + index + "Input']"));
    assert.match(app, new RegExp("'comfyReference" + index + "Node','comfyReference" + index + "Input'"));
    assert.match(html, new RegExp('id="comfyReference' + index + 'Node"'));
    assert.match(html, new RegExp('id="comfyReference' + index + 'Input"'));
    assert.match(html, new RegExp('id="comfyCharacterReference' + index + '"'));
  }
});

test('all ComfyUI generation paths share the four-reference limit', () => {
  assert.match(app, /if\(images\.length>=CHARACTER_REFERENCE_IMAGE_LIMIT\)break;/);
  assert.equal((app.match(/\.slice\(0,CHARACTER_REFERENCE_IMAGE_LIMIT\)/g) || []).length, 3);
  assert.match(app, /profileReferences\.concat\(comfyCharacterReferenceFiles\.filter\(Boolean\)\)\.slice\(0,CHARACTER_REFERENCE_IMAGE_LIMIT\)/);
  assert.match(app, /profileReferenceImages\.concat\(comfyCharacterReferenceFiles\.filter\(Boolean\)\)\.slice\(0,CHARACTER_REFERENCE_IMAGE_LIMIT\)/);
});

test('reference 3 and 4 changes invalidate the ComfyUI connection just like the first two slots', () => {
  const configStart = app.indexOf('const comfyConfigurationInputIds=[');
  const configEnd = app.indexOf('];', configStart);
  assert.ok(configStart >= 0 && configEnd > configStart);
  const config = app.slice(configStart, configEnd);
  for (const index of [1, 2, 3, 4]) {
    assert.ok(config.includes("'comfyReference" + index + "Node'"));
    assert.ok(config.includes("'comfyReference" + index + "Input'"));
  }
});

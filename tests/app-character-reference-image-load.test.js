import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

test('ComfyUI Character Bible loading uses the fail-closed IndexedDB reference loader', () => {
  assert.match(app, /import \{ loadCharacterReferenceImagesFromStorage \} from ["']\.\/character-reference-image-load\.js["']/);
  const start = app.indexOf('async function loadCharacterReferenceImagesForScene(scene)');
  const end = app.indexOf('async function buildCharacterReferenceImagesForScene(scene)', start);
  assert.ok(start >= 0 && end > start);
  const block = app.slice(start, end);
  assert.match(block, /loadCharacterReferenceImagesFromStorage\(\{scene,characterBible,storage:characterReferenceImageStorage\}\)/);
  assert.match(block, /error\?\.code==='CHARACTER_REFERENCE_IMAGE_MISSING'&&uiLang==='ru'/);
  assert.match(block, /Повторно загрузи фото в Character Bible/);
  assert.doesNotMatch(block, /if\(record\?\.blob\?\.size\)images\.push/);
});

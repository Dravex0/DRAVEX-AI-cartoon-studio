import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

test('Character Bible text, photo upload, and photo removal invalidate affected scene generations and cached clips', () => {
  const saveStart = app.indexOf("$('saveCharacterReference').addEventListener");
  const uploadStart = app.indexOf("$('bibleReferenceImageFile').addEventListener");
  const removeStart = app.indexOf("$('removeCharacterReferenceImage').addEventListener");
  assert.ok(saveStart >= 0 && uploadStart > saveStart && removeStart > uploadStart);
  const saveBlock = app.slice(saveStart, uploadStart);
  const uploadBlock = app.slice(uploadStart, removeStart);
  const removeBlock = app.slice(removeStart, app.indexOf('async function loadCharacterReferenceImagesForScene', removeStart));
  for (const block of [saveBlock, uploadBlock, removeBlock]) {
    assert.match(block, /invalidateCharacterReferenceScenes\\(characterId\\)/);
  }
  const helperStart = app.indexOf('function invalidateCharacterReferenceScenes(characterId)');
  const helperEnd = app.indexOf("['sceneCamera'", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  const helper = app.slice(helperStart, helperEnd);
  assert.match(helper, /sceneGenerationGuard\\.invalidate\\(key\\)/);
  assert.match(helper, /await sceneVideoStorage\\.deleteOlderThanRevision\\(key,revision\\)/);
  assert.match(helper, /await sceneVideoRestorePromise/);
  assert.match(helper, /disposeSceneVideoEntry\\(entry\\)/);
});

test('direct ComfyUI scene generation waits for persisted video restoration before submitting a new job', () => {
  const start = app.indexOf("$('animateSceneComfy').addEventListener");
  const end = app.indexOf("$('videoGenerationMode')", start);
  assert.ok(start >= 0 && end > start);
  const block = app.slice(start, end);
  const restore = block.indexOf('await sceneVideoRestorePromise;');
  const guard = block.indexOf('assertGenerationCurrent();', restore);
  const provider = block.indexOf('createComfyUIVideoProvider(comfyProviderOptions())');
  assert.ok(restore >= 0 && guard > restore && provider > guard);
});

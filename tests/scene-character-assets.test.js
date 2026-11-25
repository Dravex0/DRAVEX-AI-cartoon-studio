import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { collectSceneCharacterImageUrls } from '../src/scene-character-assets.js';

const appSource = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

const bodyRig = {
  schemaVersion: 1,
  characterId: 'Foxy',
  bones: [{ id: 'root' }],
  parts: [
    { id: 'body', boneId: 'root', imageUrl: 'https://example.com/body.png' },
    { id: 'head', boneId: 'root', imageUrl: 'blob:https://example.com/head' }
  ]
};

test('collects visible sprite and valid rig-part images once for export readiness', () => {
  const urls = collectSceneCharacterImageUrls({
    characterLayers: [
      { characterId: 'Foxy', imageUrl: 'https://example.com/sprite.png', visible: true },
      { characterId: 'Hidden', imageUrl: 'https://example.com/hidden.png', visible: false },
      { characterId: 'Foxy', imageUrl: 'https://example.com/duplicate.png', visible: true }
    ],
    characterRigs: [bodyRig, { ...bodyRig, schemaVersion: 99, characterId: 'Invalid' }]
  });
  assert.deepEqual(urls, [
    'https://example.com/sprite.png',
    'https://example.com/body.png',
    'blob:https://example.com/head'
  ]);
});

test('ignores scenes without drawable character image assets', () => {
  assert.deepEqual(collectSceneCharacterImageUrls({
    characterLayers: [{ characterId: 'Empty', imageUrl: '', visible: true }],
    characterRigs: [{ ...bodyRig, parts: [] }]
  }), []);
});

test('full-film export waits for character images before starting MediaRecorder', () => {
  const start = appSource.indexOf('async function exportFilm(');
  const end = appSource.indexOf("\n$('export').onclick", start);
  assert.ok(start >= 0 && end > start, 'exportFilm must be present');
  const block = appSource.slice(start, end);
  const collect = block.indexOf('collectSceneCharacterImageUrls(meta)');
  const wait = block.indexOf('waitForSceneImageReady(characterImageEntry.image');
  const recorder = block.indexOf('recorder.start(250);');
  assert.ok(collect >= 0, 'export preflight must collect body character images');
  assert.ok(wait > collect, 'export preflight must await decoded character images');
  assert.ok(recorder > wait, 'MediaRecorder must not start before character images are ready');
});




test('full-film video export cannot bypass the character-evidence preflight', () => {
  const start = appSource.indexOf('async function exportFilm(');
  const end = appSource.indexOf("$('export').onclick", start);
  assert.ok(start >= 0 && end > start, 'exportFilm must be present');
  const block = appSource.slice(start, end);
  const gate = block.indexOf('const missingCharacterAssetCount=getMissingCharacterVisualCount(exportProtagonistId)');
  const allVideosSnapshot = block.indexOf('if(requireAllVideos)');
  const recorder = block.indexOf('recorder.start(250);');
  assert.ok(gate >= 0 && allVideosSnapshot > gate,
    'full-film mode must pass character evidence before accepting the all-videos snapshot');
  assert.match(block.slice(gate, allVideosSnapshot), /if\(missingCharacterAssetCount>0\)/,
    'decoded scene clips alone must not bypass the character-evidence gate');
  assert.ok(recorder > allVideosSnapshot, 'MediaRecorder must start only after both visual and video readiness checks');
});
test('direct WebM export applies the shared character-visual gate before MediaRecorder starts', () => {
  const start = appSource.indexOf('async function exportFilm(');
  const end = appSource.indexOf("$('export').onclick", start);
  assert.ok(start >= 0 && end > start, 'exportFilm must be present');
  const block = appSource.slice(start, end);
  const gate = block.indexOf('getMissingCharacterVisualCount(exportProtagonistId)');
  const blockedMessage = block.indexOf('background-only export is blocked');
  const recorder = block.indexOf('recorder.start(250);');
  assert.ok(gate >= 0, 'direct export must use the shared character-visual readiness check');
  assert.ok(blockedMessage > gate, 'missing character visuals must produce an explicit blocker');
  assert.ok(recorder > blockedMessage, 'MediaRecorder must not start after a blocked visual preflight');
});


test('direct export restores persisted scene clips before character readiness is evaluated', () => {
  const start = appSource.indexOf('async function exportFilm(');
  const end = appSource.indexOf("$('export').onclick", start);
  assert.ok(start >= 0 && end > start, 'exportFilm must be present');
  const block = appSource.slice(start, end);
  const lock = block.indexOf('button.disabled=true;');
  const restore = block.indexOf('await sceneVideoRestorePromise;');
  const gate = block.indexOf('const missingCharacterAssetCount=getMissingCharacterVisualCount(exportProtagonistId)');
  assert.ok(lock >= 0 && restore > lock && gate > restore,
    'the export must be locked while persisted clips restore and must evaluate readiness only afterward');
});

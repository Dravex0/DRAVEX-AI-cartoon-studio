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

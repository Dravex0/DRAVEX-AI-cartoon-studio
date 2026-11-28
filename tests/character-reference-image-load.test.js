import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CharacterReferenceImageLoadError,
  loadCharacterReferenceImagesFromStorage
} from '../src/character-reference-image-load.js';

const imageBlob = (value, type = 'image/png') => new Blob([value], { type });
const profile = (characterId, referenceImageAssetId) => ({
  characterId,
  referenceImageAssetId,
  visualDescription: characterId + ' visual identity'
});

test('loads saved images in scene-cast order and ignores profiles outside the scene', async () => {
  const records = new Map([
    ['asset_mira_0001', { filename: 'mira.webp', mimeType: 'image/webp', blob: imageBlob('mira', 'image/webp') }],
    ['asset_foxy_0001', { filename: 'foxy.jpg', mimeType: 'image/jpeg', blob: imageBlob('foxy', 'image/jpeg') }],
    ['asset_bird_0001', { filename: 'bird.png', mimeType: 'image/png', blob: imageBlob('bird') }]
  ]);
  const calls = [];
  const images = await loadCharacterReferenceImagesFromStorage({
    scene: { characters: ['Foxy', 'Mira'] },
    characterBible: [
      profile('Mira', 'asset_mira_0001'),
      profile('Bird', 'asset_bird_0001'),
      profile('Foxy', 'asset_foxy_0001')
    ],
    storage: { async get(id) { calls.push(id); return records.get(id) || null; } }
  });

  assert.deepEqual(calls, ['asset_foxy_0001', 'asset_mira_0001']);
  assert.deepEqual(images.map(item => item.name), ['foxy.jpg', 'mira.webp']);
  assert.deepEqual(await Promise.all(images.map(item => item.blob.text())), ['foxy', 'mira']);
});

test('fails closed when a Character Bible profile references an image missing from IndexedDB', async () => {
  const storage = {
    async get(id) {
      return id === 'asset_foxy_0001'
        ? { filename: 'foxy.png', mimeType: 'image/png', blob: imageBlob('foxy') }
        : null;
    }
  };

  await assert.rejects(
    () => loadCharacterReferenceImagesFromStorage({
      scene: { characters: ['Foxy', 'Mira'] },
      characterBible: [profile('Foxy', 'asset_foxy_0001'), profile('Mira', 'asset_mira_0001')],
      storage
    }),
    error => error instanceof CharacterReferenceImageLoadError
      && error.code === 'CHARACTER_REFERENCE_IMAGE_MISSING'
      && error.characterIds.includes('Mira')
      && /Re-upload/.test(error.message)
  );
});

test('rejects empty and unsupported stored blobs instead of silently dropping identity references', async () => {
  for (const record of [
    { filename: 'empty.png', mimeType: 'image/png', blob: imageBlob('', 'image/png') },
    { filename: 'document.pdf', mimeType: 'application/pdf', blob: imageBlob('pdf', 'application/pdf') }
  ]) {
    await assert.rejects(
      () => loadCharacterReferenceImagesFromStorage({
        scene: { characters: ['Foxy'] },
        characterBible: [profile('Foxy', 'asset_foxy_0001')],
        storage: { async get() { return record; } }
      }),
      error => error.code === 'CHARACTER_REFERENCE_IMAGE_MISSING'
    );
  }
});

test('does not require storage records for cast members without a saved image asset', async () => {
  let reads = 0;
  const images = await loadCharacterReferenceImagesFromStorage({
    scene: { characters: 'Foxy, Mira' },
    characterBible: [profile('Foxy', ''), profile('Mira', '')],
    storage: { async get() { reads += 1; return null; } }
  });
  assert.deepEqual(images, []);
  assert.equal(reads, 0);
});

test('rejects a missing storage adapter explicitly', async () => {
  await assert.rejects(
    () => loadCharacterReferenceImagesFromStorage({ scene: { characters: ['Foxy'] } }),
    /storage must provide get/
  );
});

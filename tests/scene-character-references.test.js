import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCharacterReferenceImagesForScene } from '../src/scene-character-references.js';

function createStorage(records) {
  const calls = [];
  return {
    calls,
    async get(assetId) {
      calls.push(assetId);
      return records.get(assetId);
    }
  };
}

test('loads only the saved photos belonging to the explicit scene cast', async () => {
  const fox = new Blob(['fox'], { type: 'image/png' });
  const bird = new Blob(['bird'], { type: 'image/png' });
  const wolf = new Blob(['wolf'], { type: 'image/png' });
  const storage = createStorage(new Map([
    ['fox-ref', { blob: fox, filename: 'fox.png' }],
    ['bird-ref', { blob: bird, filename: 'bird.webp' }],
    ['wolf-ref', { blob: wolf, filename: 'wolf.png' }]
  ]));
  const images = await loadCharacterReferenceImagesForScene(
    { characters: ['FOX', 'Bird'] },
    [
      { characterId: 'Fox', referenceImageAssetId: 'fox-ref' },
      { characterId: 'Wolf', referenceImageAssetId: 'wolf-ref' },
      { characterId: 'Bird', referenceImageAssetId: 'bird-ref' }
    ],
    storage
  );

  assert.deepEqual(images.map(image => image.name), ['fox.png', 'bird.webp']);
  assert.deepEqual(storage.calls, ['fox-ref', 'bird-ref']);
  assert.equal(images[0].blob, fox);
  assert.equal(images[1].blob, bird);
});

test('ignores profiles without a saved asset or a readable non-empty image', async () => {
  const storage = createStorage(new Map([
    ['empty-ref', { blob: new Blob([]), filename: 'empty.png' }],
    ['valid-ref', { blob: new Blob(['valid'], { type: 'image/png' }), filename: 'valid.png' }]
  ]));
  const images = await loadCharacterReferenceImagesForScene(
    { characters: ['A', 'B', 'C'] },
    [
      { characterId: 'A' },
      { characterId: 'B', referenceImageAssetId: 'empty-ref' },
      { characterId: 'C', referenceImageAssetId: 'valid-ref' }
    ],
    storage
  );
  assert.deepEqual(images.map(image => image.name), ['valid.png']);
  assert.deepEqual(storage.calls, ['empty-ref', 'valid-ref']);
});

test('caps the result at two images and preserves character-bible order', async () => {
  const records = new Map(
    ['one', 'two', 'three'].map(id => [id, {
      blob: new Blob([id], { type: 'image/png' }),
      filename: id + '.png'
    }])
  );
  const storage = createStorage(records);
  const images = await loadCharacterReferenceImagesForScene(
    { characters: ['One', 'Two', 'Three'] },
    [
      { characterId: 'One', referenceImageAssetId: 'one' },
      { characterId: 'Two', referenceImageAssetId: 'two' },
      { characterId: 'Three', referenceImageAssetId: 'three' }
    ],
    storage,
    10
  );
  assert.deepEqual(images.map(image => image.name), ['one.png', 'two.png']);
  assert.deepEqual(storage.calls, ['one', 'two']);
});

test('returns no photos when the scene has no explicit cast or storage is unavailable', async () => {
  const storage = createStorage(new Map());
  assert.deepEqual(await loadCharacterReferenceImagesForScene({}, [
    { characterId: 'One', referenceImageAssetId: 'one' }
  ], storage), []);
  assert.deepEqual(await loadCharacterReferenceImagesForScene(
    { characters: ['One'] },
    [{ characterId: 'One', referenceImageAssetId: 'one' }],
    null
  ), []);
});

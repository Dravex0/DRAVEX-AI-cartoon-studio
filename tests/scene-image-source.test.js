import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSceneImageBlob, resolveSceneImageSource } from '../src/scene-image-source.js';

test('uses the selected local image for the active ComfyUI scene', () => {
  const image = new Blob(['image'], { type: 'image/png' });
  assert.deepEqual(resolveSceneImageSource({
    mode: 'comfyui', sceneIndex: 0, activeSceneIndex: 0,
    localImage: image, generatedImageUrl: ''
  }), { kind: 'blob', image });
});

test('does not reuse one local image for other scenes or remote providers', () => {
  const image = new Blob(['image'], { type: 'image/png' });
  assert.deepEqual(resolveSceneImageSource({
    mode: 'comfyui', sceneIndex: 1, activeSceneIndex: 0,
    localImage: image, generatedImageUrl: ''
  }), { kind: 'missing' });
  assert.deepEqual(resolveSceneImageSource({
    mode: 'huggingface', sceneIndex: 0, activeSceneIndex: 0,
    localImage: image, generatedImageUrl: ''
  }), { kind: 'missing' });
});

test('uses a generated image URL when no applicable local image is selected', () => {
  assert.deepEqual(resolveSceneImageSource({
    mode: 'comfyui', sceneIndex: 1, activeSceneIndex: 0,
    localImage: null, generatedImageUrl: ' https://images.example/scene.png '
  }), { kind: 'url', url: 'https://images.example/scene.png' });
});

test('returns missing for an empty or invalid source', () => {
  assert.deepEqual(resolveSceneImageSource({ mode: 'comfyui' }), { kind: 'missing' });
});


test('loads generated image URLs into non-empty Blobs for video providers', async () => {
  const expected = new Blob(['image'], { type: 'image/png' });
  const controller = new AbortController();
  const calls = [];
  const loaded = await loadSceneImageBlob(
    { kind: 'url', url: 'https://images.example/scene.png' },
    {
      signal: controller.signal,
      fetchImpl: async (...args) => {
        calls.push(args);
        return { ok: true, blob: async () => expected };
      }
    }
  );

  assert.equal(loaded, expected);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://images.example/scene.png');
  assert.equal(calls[0][1].signal, controller.signal);
});

test('reuses a selected local Blob without fetching it again', async () => {
  const image = new Blob(['local image'], { type: 'image/png' });
  let fetchCalls = 0;
  const loaded = await loadSceneImageBlob(
    { kind: 'blob', image },
    { fetchImpl: async () => { fetchCalls += 1; throw new Error('unexpected fetch'); } }
  );

  assert.equal(loaded, image);
  assert.equal(fetchCalls, 0);
});

test('rejects failed and empty generated-image downloads', async () => {
  await assert.rejects(
    loadSceneImageBlob(
      { kind: 'url', url: 'https://images.example/missing.png' },
      { fetchImpl: async () => ({ ok: false, status: 503 }) }
    ),
    /HTTP 503/
  );

  await assert.rejects(
    loadSceneImageBlob(
      { kind: 'url', url: 'https://images.example/empty.png' },
      { fetchImpl: async () => ({ ok: true, blob: async () => new Blob([]) }) }
    ),
    /scene image is empty/
  );
});

test('returns null when a scene has no image source', async () => {
  assert.equal(await loadSceneImageBlob({ kind: 'missing' }), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSceneImageSource } from '../src/scene-image-source.js';

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

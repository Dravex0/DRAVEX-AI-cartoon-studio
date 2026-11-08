import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSceneVideoTaskType } from '../src/scene-video-task.js';

test('uses text-to-video for a local ComfyUI scene without a still image', () => {
  assert.equal(resolveSceneVideoTaskType({ mode: 'comfyui', imageSourceKind: 'missing' }), 'text-to-video');
});

test('uses image-to-video when a local image or generated still is available', () => {
  assert.equal(resolveSceneVideoTaskType({ mode: 'comfyui', imageSourceKind: 'blob' }), 'image-to-video');
  assert.equal(resolveSceneVideoTaskType({ mode: 'comfyui', imageSourceKind: 'url' }), 'image-to-video');
});

test('keeps image-to-video for other providers', () => {
  assert.equal(resolveSceneVideoTaskType({ mode: 'huggingface', imageSourceKind: 'missing' }), 'image-to-video');
});

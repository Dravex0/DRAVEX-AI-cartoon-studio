import test from 'node:test';
import assert from 'node:assert/strict';
import { getPromptCameraTransform } from '../src/prompt-camera-motion.js';

test('zoom-in prompt smoothly increases scale across the shot', () => {
  const start = getPromptCameraTransform('Slow push in toward the character', 0);
  const middle = getPromptCameraTransform('Slow push in toward the character', 0.5);
  const end = getPromptCameraTransform('Slow push in toward the character', 1);
  assert.ok(start.zoom < middle.zoom);
  assert.ok(middle.zoom < end.zoom);
  assert.equal(start.panX, 0);
});

test('pan left and tilt up move the crop in the expected bounded direction', () => {
  const start = getPromptCameraTransform('Pan left and tilt up', 0);
  const end = getPromptCameraTransform('Pan left and tilt up', 1);
  assert.equal(start.panX, 0);
  assert.equal(start.panY, 0);
  assert.ok(end.panX > 0);
  assert.ok(end.panY > 0);
  assert.ok(end.panX <= 0.6 && end.panY <= 0.6);
});

test('zoom-out and pan-right are supported', () => {
  const start = getPromptCameraTransform('Pull back and pan right', 0);
  const end = getPromptCameraTransform('Pull back and pan right', 1);
  assert.ok(start.zoom > end.zoom);
  assert.ok(end.panX < 0);
});

test('Russian camera directions are recognized', () => {
  const end = getPromptCameraTransform('Камера влево, затем приближается', 1);
  assert.ok(end.panX > 0);
  assert.ok(end.zoom > 1.08);
});

test('static camera remains locked and malformed progress is safe', () => {
  assert.deepEqual(getPromptCameraTransform('Static camera, locked shot', 1), {
    zoom: 1.02, panX: 0, panY: 0
  });
  const invalid = getPromptCameraTransform('pan left', NaN);
  assert.deepEqual(invalid, { zoom: 1.025, panX: 0, panY: 0 });
});

test('progress and transform remain bounded for out-of-range inputs', () => {
  const start = getPromptCameraTransform('pan right tilt down', -10);
  const end = getPromptCameraTransform('pan right tilt down', 10);
  assert.deepEqual(start, { zoom: 1.025, panX: 0, panY: 0 });
  assert.ok(end.zoom <= 1.12 && end.zoom >= 1.02);
  assert.ok(end.panX >= -0.6 && end.panY >= -0.6);
});

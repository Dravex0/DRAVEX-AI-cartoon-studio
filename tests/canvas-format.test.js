import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCanvasDimensions,
  getCanvasFormat,
  getImageGenerationDimensions,
  normalizeCanvasFormat
} from '../src/canvas-format.js';

test('landscape remains the backward-compatible default', () => {
  assert.equal(normalizeCanvasFormat(), 'landscape');
  assert.deepEqual(getCanvasDimensions(), {
    width: 1280, height: 720, logicalWidth: 640, logicalHeight: 360, aspectRatio: '16:9'
  });
});

test('portrait format exposes a true 9:16 canvas and logical scene space', () => {
  assert.equal(normalizeCanvasFormat('9:16'), 'portrait');
  assert.deepEqual(getCanvasDimensions('portrait'), {
    width: 720, height: 1280, logicalWidth: 360, logicalHeight: 640, aspectRatio: '9:16'
  });
});

test('unknown format safely falls back to landscape', () => {
  assert.equal(getCanvasFormat('square').id, 'landscape');
  assert.equal(getCanvasDimensions('invalid').aspectRatio, '16:9');
});

test('image generation quality profiles preserve each format orientation', () => {
  assert.deepEqual(getImageGenerationDimensions('portrait', 'standard'), {
    width: 384, height: 640, steps: 20
  });
  assert.deepEqual(getImageGenerationDimensions('portrait', 'high'), {
    width: 448, height: 768, steps: 24
  });
  assert.deepEqual(getImageGenerationDimensions('portrait', 'ultra'), {
    width: 576, height: 1024, steps: 30
  });
  assert.deepEqual(getImageGenerationDimensions('landscape', 'ultra'), {
    width: 1024, height: 576, steps: 30
  });
});

test('quality profiles are returned as independent objects', () => {
  const profile = getImageGenerationDimensions('portrait', 'standard');
  profile.width = 1;
  assert.equal(getImageGenerationDimensions('portrait', 'standard').width, 384);
});

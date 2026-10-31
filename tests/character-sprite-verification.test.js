import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySpriteTransparency } from '../src/character-sprite-verification.js';

function rgba(alphas) {
  const data = new Uint8ClampedArray(alphas.length * 4);
  alphas.forEach((alpha, index) => { data[index * 4 + 3] = alpha; });
  return { data };
}

test('accepts a sprite with transparent canvas and visible subject pixels', () => {
  const result = verifySpriteTransparency(rgba([0, 0, 255, 255, 255, 0, 128, 255]), 4, 2);
  assert.equal(result.passed, true);
  assert.equal(result.status, 'verified');
  assert.equal(result.transparentRatio, 0.375);
  assert.equal(result.visibleRatio, 0.5);
});

test('rejects an opaque image because a transparent prompt did not produce transparency', () => {
  const result = verifySpriteTransparency(rgba([255, 255, 255, 255]), 2, 2);
  assert.equal(result.passed, false);
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'insufficient-transparent-pixels');
});

test('rejects a blank transparent image with no visible subject pixels', () => {
  const result = verifySpriteTransparency(rgba([0, 0, 0, 0]), 2, 2);
  assert.equal(result.passed, false);
  assert.equal(result.reason, 'image-mostly-transparent');
});

test('rejects malformed dimensions and pixel buffers without throwing', () => {
  assert.deepEqual(verifySpriteTransparency(null, 2, 2), {
    passed: false, status: 'unverified', reason: 'invalid-image-data'
  });
  assert.equal(verifySpriteTransparency(rgba([255]), 0, 1).reason, 'invalid-image-data');
});

test('rejects invalid threshold configuration', () => {
  assert.equal(
    verifySpriteTransparency(rgba([0, 255]), 2, 1, { minTransparentRatio: 0.96 }).reason,
    'invalid-thresholds'
  );
});

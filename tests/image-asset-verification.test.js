import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectImageAlphaChannel,
  validateSceneCompositeReadiness,
  verifyBackgroundComposition
} from '../src/image-asset-verification.js';

function rgba(alphas) {
  const data = new Uint8ClampedArray(alphas.length * 4);
  alphas.forEach((alpha, index) => { data[index * 4 + 3] = alpha; });
  return data;
}

test('detects transparent pixels from decoded RGBA data without claiming semantic recognition', () => {
  const result = inspectImageAlphaChannel({ width: 2, height: 2, data: rgba([255, 0, 128, 255]) });
  assert.equal(result.status, 'transparent');
  assert.equal(result.transparentPixelCount, 2);
  assert.equal(result.transparentPixelRatio, 0.5);
  assert.equal(result.pixelCount, 4);
});

test('reports opaque images and rejects malformed or excessive image buffers', () => {
  assert.equal(inspectImageAlphaChannel({ width: 1, height: 2, data: rgba([255, 255]) }).status, 'opaque');
  assert.equal(inspectImageAlphaChannel({ width: 2, height: 2, data: rgba([255]) }).status, 'invalid');
  assert.equal(inspectImageAlphaChannel({ width: 5000, height: 5000, data: [] }).reason, 'invalid-image-data');
});

test('uses a configurable alpha threshold and rejects invalid alpha samples', () => {
  assert.equal(inspectImageAlphaChannel({ width: 1, height: 1, data: rgba([254]), alphaThreshold: 255 }).status, 'transparent');
  const data = [0, 0, 0, 300];
  assert.equal(inspectImageAlphaChannel({ width: 1, height: 1, data }).reason, 'invalid-alpha-value');
});

test('background plate stays unverified until the user explicitly confirms visual inspection', () => {
  const asset = { assetRole: 'scene-background', assetId: 'bg-1', sceneId: 'scene-1', imageUrl: 'https://cdn.example/bg.png' };
  assert.equal(verifyBackgroundComposition({ asset }).status, 'unverified');
  assert.deepEqual(verifyBackgroundComposition({ asset, userConfirmedCharacterFree: true, verifiedAt: '2026-10-31T10:00:00Z' }), {
    status: 'user-verified', reason: '', sceneId: 'scene-1', assetId: 'bg-1',
    verifiedAt: '2026-10-31T10:00:00.000Z', verificationMethod: 'explicit-user-visual-check'
  });
});

test('rejects invalid background references and verification timestamps', () => {
  assert.equal(verifyBackgroundComposition({ asset: { assetRole: 'scene-background', imageUrl: 'http://cdn.example/bg.png' }, userConfirmedCharacterFree: true }).status, 'blocked');
  assert.equal(verifyBackgroundComposition({
    asset: { assetRole: 'scene-background', imageUrl: 'https://cdn.example/bg.png' },
    userConfirmedCharacterFree: true, verifiedAt: 'not-a-date'
  }).reason, 'invalid-verification-timestamp');
});

test('compositing readiness blocks unverified backgrounds and sprite transparency', () => {
  const backgroundAsset = { assetRole: 'scene-background', sceneId: 'scene-1', imageUrl: 'https://cdn.example/bg.png', compositionStatus: 'unverified' };
  const sprite = { assetRole: 'character-sprite', sceneId: 'scene-1', imageUrl: 'https://cdn.example/fox.png', transparencyStatus: 'unverified' };
  const blocked = validateSceneCompositeReadiness({ backgroundAsset, characterSpriteAssets: [sprite] });
  assert.equal(blocked.ready, false);
  assert.deepEqual(blocked.errors, ['background-visual-verification-required', 'sprite-0-transparency-unverified']);
});

test('allows readiness only when the background and every matching sprite are verified', () => {
  const result = validateSceneCompositeReadiness({
    backgroundAsset: { assetRole: 'scene-background', sceneId: 'scene-1', imageUrl: 'https://cdn.example/bg.png', compositionStatus: 'user-verified' },
    characterSpriteAssets: [
      { assetRole: 'character-sprite', sceneId: 'scene-1', imageUrl: 'https://cdn.example/fox.png', transparencyStatus: 'verified-transparent' },
      { assetRole: 'character-sprite', sceneId: 'scene-1', imageUrl: 'https://cdn.example/bird.png', transparencyStatus: 'verified-transparent' }
    ]
  });
  assert.deepEqual(result, { ready: true, errors: [] });
});

test('blocks mismatched scene IDs, empty sprite sets, and insecure URLs', () => {
  const backgroundAsset = { assetRole: 'scene-background', sceneId: 'scene-1', imageUrl: 'https://cdn.example/bg.png', compositionStatus: 'user-verified' };
  assert.equal(validateSceneCompositeReadiness({ backgroundAsset }).ready, false);
  const mismatch = validateSceneCompositeReadiness({
    backgroundAsset,
    characterSpriteAssets: [{ assetRole: 'character-sprite', sceneId: 'scene-2', imageUrl: 'https://cdn.example/fox.png', transparencyStatus: 'verified-transparent' }]
  });
  assert.deepEqual(mismatch.errors, ['sprite-0-scene-mismatch']);
  assert.equal(validateSceneCompositeReadiness({
    backgroundAsset: { ...backgroundAsset, imageUrl: 'http://cdn.example/bg.png' },
    characterSpriteAssets: [{ assetRole: 'character-sprite', imageUrl: 'https://cdn.example/fox.png', transparencyStatus: 'verified-transparent' }]
  }).ready, false);
});

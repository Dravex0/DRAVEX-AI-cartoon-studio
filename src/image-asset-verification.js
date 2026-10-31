const MAX_IMAGE_PIXELS = 16_777_216;
const clean = (value, max = 2048) => String(value ?? '').trim().slice(0, max);

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

/**
 * Inspect raw RGBA pixel data supplied by a local decoder (for example ImageData).
 * This checks alpha values only; it does not identify objects or judge cutout quality.
 */
export function inspectImageAlphaChannel({ width, height, data, alphaThreshold = 254 } = {}) {
  const w = Number(width), h = Number(height), threshold = Number(alphaThreshold);
  if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0 ||
      w * h > MAX_IMAGE_PIXELS || !Number.isInteger(threshold) || threshold < 0 || threshold > 255 ||
      (!ArrayBuffer.isView(data) && !Array.isArray(data)) || data.length !== w * h * 4) {
    return { status: 'invalid', reason: 'invalid-image-data', pixelCount: 0, transparentPixelCount: 0, transparentPixelRatio: 0 };
  }
  let transparentPixelCount = 0;
  for (let offset = 3; offset < data.length; offset += 4) {
    const alpha = Number(data[offset]);
    if (!Number.isInteger(alpha) || alpha < 0 || alpha > 255) {
      return { status: 'invalid', reason: 'invalid-alpha-value', pixelCount: w * h, transparentPixelCount: 0, transparentPixelRatio: 0 };
    }
    if (alpha < threshold) transparentPixelCount++;
  }
  const pixelCount = w * h;
  return {
    status: transparentPixelCount > 0 ? 'transparent' : 'opaque',
    reason: '',
    pixelCount,
    transparentPixelCount,
    transparentPixelRatio: transparentPixelCount / pixelCount,
    alphaThreshold: threshold
  };
}

/**
 * Record a user's explicit visual check of a background plate.
 * This is an attestation, not automatic semantic image recognition.
 */
export function verifyBackgroundComposition({ asset, userConfirmedCharacterFree = false, verifiedAt = new Date().toISOString() } = {}) {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset) ||
      asset.assetRole !== 'scene-background' || !safeHttpsUrl(asset.imageUrl)) {
    return { status: 'blocked', reason: 'invalid-background-asset' };
  }
  if (userConfirmedCharacterFree !== true) {
    return { status: 'unverified', reason: 'explicit-visual-confirmation-required' };
  }
  const timestamp = Date.parse(String(verifiedAt));
  if (!Number.isFinite(timestamp)) {
    return { status: 'blocked', reason: 'invalid-verification-timestamp' };
  }
  return {
    status: 'user-verified',
    reason: '',
    sceneId: clean(asset.sceneId, 120),
    assetId: clean(asset.assetId, 240),
    verifiedAt: new Date(timestamp).toISOString(),
    verificationMethod: 'explicit-user-visual-check'
  };
}

/**
 * Strict readiness contract for future scene compositing.
 * No drawing is performed here; unverified assets are never declared ready.
 */
export function validateSceneCompositeReadiness({ backgroundAsset, characterSpriteAssets = [] } = {}) {
  const errors = [];
  if (!backgroundAsset || backgroundAsset.assetRole !== 'scene-background' ||
      !safeHttpsUrl(backgroundAsset.imageUrl)) {
    errors.push('valid-background-required');
  } else if (backgroundAsset.compositionStatus !== 'user-verified') {
    errors.push('background-visual-verification-required');
  }
  if (!Array.isArray(characterSpriteAssets) || characterSpriteAssets.length === 0) {
    errors.push('at-least-one-character-sprite-required');
  } else {
    for (const [index, asset] of characterSpriteAssets.entries()) {
      if (!asset || asset.assetRole !== 'character-sprite' || !safeHttpsUrl(asset.imageUrl)) {
        errors.push(`sprite-${index}-invalid`);
        continue;
      }
      if (asset.transparencyStatus !== 'verified-transparent') {
        errors.push(`sprite-${index}-transparency-unverified`);
      }
      if (backgroundAsset?.sceneId && asset.sceneId && asset.sceneId !== backgroundAsset.sceneId) {
        errors.push(`sprite-${index}-scene-mismatch`);
      }
    }
  }
  return { ready: errors.length === 0, errors };
}

/**
 * Inspect decoded RGBA pixels for real transparency.
 * This verifies the alpha channel only; it does not verify character identity,
 * anatomy, pose, or whether the background is semantically clean.
 */
export function verifySpriteTransparency(imageData, width, height, {
  minTransparentRatio = 0.01,
  maxTransparentRatio = 0.95,
  minVisibleRatio = 0.02
} = {}) {
  const w = Number(width), h = Number(height);
  const data = imageData?.data;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0 ||
      !data || typeof data.length !== 'number' || data.length !== w * h * 4) {
    return { passed: false, status: 'unverified', reason: 'invalid-image-data' };
  }
  const thresholds = [minTransparentRatio, maxTransparentRatio, minVisibleRatio].map(Number);
  if (!thresholds.every(Number.isFinite) || thresholds[0] < 0 ||
      thresholds[1] > 1 || thresholds[0] >= thresholds[1] ||
      thresholds[2] < 0 || thresholds[2] > 1) {
    return { passed: false, status: 'unverified', reason: 'invalid-thresholds' };
  }

  let transparent = 0, visible = 0, partial = 0;
  for (let i = 3; i < data.length; i += 4) {
    const alpha = Number(data[i]);
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 255) {
      return { passed: false, status: 'unverified', reason: 'invalid-alpha-channel' };
    }
    if (alpha <= 8) transparent++;
    else if (alpha >= 247) visible++;
    else partial++;
  }
  const total = w * h;
  const transparentRatio = transparent / total;
  const visibleRatio = visible / total;
  const partialRatio = partial / total;
  const passed = transparentRatio >= thresholds[0] &&
    transparentRatio <= thresholds[1] && visibleRatio >= thresholds[2];
  return {
    passed,
    status: passed ? 'verified' : 'failed',
    reason: passed ? null : transparentRatio < thresholds[0]
      ? 'insufficient-transparent-pixels'
      : transparentRatio > thresholds[1]
        ? 'image-mostly-transparent'
        : 'insufficient-opaque-subject-pixels',
    width: w,
    height: h,
    transparentRatio: Number(transparentRatio.toFixed(4)),
    visibleRatio: Number(visibleRatio.toFixed(4)),
    partialRatio: Number(partialRatio.toFixed(4))
  };
}

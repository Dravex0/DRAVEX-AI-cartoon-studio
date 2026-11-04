/**
 * Compare decoded RGBA video frames using a simple pixel-difference heuristic.
 *
 * This detects image changes only. It cannot identify characters, judge animation
 * quality, distinguish intended motion from camera movement, or detect semantic
 * continuity. Callers should sample frames at meaningful time intervals.
 */
export function compareVideoFrames(previous, current, {
  pixelThreshold = 12
} = {}) {
  if (!isPixelBuffer(previous) || !isPixelBuffer(current)) {
    throw new TypeError("Frames must be RGBA pixel buffers.");
  }
  if (previous.length !== current.length) {
    throw new RangeError("Compared frames must have identical dimensions.");
  }
  if (!Number.isFinite(pixelThreshold) || pixelThreshold < 0 || pixelThreshold > 255) {
    throw new RangeError("pixelThreshold must be between 0 and 255.");
  }

  const pixelCount = previous.length / 4;
  let totalDifference = 0;
  let changedPixels = 0;
  for (let offset = 0; offset < previous.length; offset += 4) {
    const difference = (
      Math.abs(previous[offset] - current[offset]) +
      Math.abs(previous[offset + 1] - current[offset + 1]) +
      Math.abs(previous[offset + 2] - current[offset + 2])
    ) / 3;
    totalDifference += difference;
    if (difference >= pixelThreshold) changedPixels += 1;
  }

  const meanAbsoluteDifference = totalDifference / pixelCount;
  const changedPixelRatio = changedPixels / pixelCount;
  return {
    pixelCount,
    meanAbsoluteDifference,
    changedPixels,
    changedPixelRatio,
    classification: changedPixelRatio < 0.01 && meanAbsoluteDifference < 2
      ? "low-pixel-change"
      : "pixel-change-detected"
  };
}

export function analyzeVideoFrameSequence(frames, options = {}) {
  if (!Array.isArray(frames)) throw new TypeError("frames must be an array.");
  if (frames.length < 2) {
    return {
      frameCount: frames.length,
      comparisonCount: 0,
      averageMeanAbsoluteDifference: 0,
      averageChangedPixelRatio: 0,
      classification: "insufficient-frames",
      comparisons: []
    };
  }

  const comparisons = [];
  for (let index = 1; index < frames.length; index += 1) {
    comparisons.push(compareVideoFrames(frames[index - 1], frames[index], options));
  }
  const averageMeanAbsoluteDifference = comparisons.reduce(
    (sum, item) => sum + item.meanAbsoluteDifference, 0
  ) / comparisons.length;
  const averageChangedPixelRatio = comparisons.reduce(
    (sum, item) => sum + item.changedPixelRatio, 0
  ) / comparisons.length;
  return {
    frameCount: frames.length,
    comparisonCount: comparisons.length,
    averageMeanAbsoluteDifference,
    averageChangedPixelRatio,
    classification: comparisons.every(item => item.classification === "low-pixel-change")
      ? "low-pixel-change"
      : "pixel-change-detected",
    comparisons
  };
}

function isPixelBuffer(value) {
  return (value instanceof Uint8Array || value instanceof Uint8ClampedArray) &&
    value.length > 0 && value.length % 4 === 0;
}


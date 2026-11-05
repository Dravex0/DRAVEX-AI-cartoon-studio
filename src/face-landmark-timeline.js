const isRecord = value => Boolean(value && typeof value === "object" && !Array.isArray(value));
const finite = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));

function interpolateValue(left, right, amount) {
  if (finite(left) && finite(right)) {
    return Number(left) + (Number(right) - Number(left)) * amount;
  }
  if (isRecord(left) && isRecord(right)) {
    const result = {};
    for (const key of Object.keys(left)) {
      if (Object.prototype.hasOwnProperty.call(right, key)) {
        result[key] = interpolateValue(left[key], right[key], amount);
      } else {
        result[key] = left[key];
      }
    }
    return result;
  }
  return left === right ? left : left;
}

function blendValue(previous, current, alpha) {
  if (finite(previous) && finite(current)) {
    return Number(previous) + (Number(current) - Number(previous)) * alpha;
  }
  if (isRecord(previous) && isRecord(current)) {
    const result = {};
    for (const key of Object.keys(current)) {
      result[key] = Object.prototype.hasOwnProperty.call(previous, key)
        ? blendValue(previous[key], current[key], alpha)
        : current[key];
    }
    return result;
  }
  return current;
}

function validSample(sample) {
  return isRecord(sample) && finite(sample.timestampMs) && Number(sample.timestampMs) >= 0;
}

function orderedSamples(samples) {
  return (Array.isArray(samples) ? samples : [])
    .filter(validSample)
    .map(sample => ({ ...sample, timestampMs: Number(sample.timestampMs) }))
    .sort((a, b) => a.timestampMs - b.timestampMs);
}

/**
 * Sample normalized facial anchors at a video timestamp.
 * Interpolation is allowed only between adjacent detected frames. A no-face or
 * invalid frame is a hard boundary, so the function never invents a face through
 * an occlusion or a missed detection.
 */
export function sampleFaceLandmarkTimeline(samples, timestampMs, { maxGapMs = 1000 } = {}) {
  const time = Number(timestampMs);
  const gapLimit = Number(maxGapMs);
  if (!Number.isFinite(time) || time < 0 || !Number.isFinite(gapLimit) || gapLimit < 0) {
    return { status: "invalid-time", anchors: null, timestampMs: null };
  }
  const ordered = orderedSamples(samples);
  if (!ordered.length) return { status: "unavailable", anchors: null, timestampMs: time };

  let left = null;
  let right = null;
  for (const sample of ordered) {
    if (sample.timestampMs === time) {
      return sample.status === "face-detected" && isRecord(sample.anchors)
        ? { status: "face-detected", anchors: sample.anchors, timestampMs: time, interpolated: false }
        : { status: sample.status === "no-face" ? "no-face" : "unavailable", anchors: null, timestampMs: time };
    }
    if (sample.timestampMs < time) left = sample;
    else { right = sample; break; }
  }
  if (!left || !right) return { status: "out-of-range", anchors: null, timestampMs: time };
  const gap = right.timestampMs - left.timestampMs;
  if (gap <= 0 || gap > gapLimit) return { status: "gap-too-large", anchors: null, timestampMs: time };
  if (left.status !== "face-detected" || right.status !== "face-detected"
      || !isRecord(left.anchors) || !isRecord(right.anchors)) {
    return { status: "no-face", anchors: null, timestampMs: time };
  }
  const amount = (time - left.timestampMs) / gap;
  return {
    status: "face-detected",
    anchors: interpolateValue(left.anchors, right.anchors, amount),
    timestampMs: time,
    interpolated: true
  };
}

/**
 * Apply exponential smoothing to detected samples in timestamp order.
 * Smoothing resets after no-face/invalid samples or a large temporal gap, avoiding
 * stale coordinates being carried across occlusions or cuts.
 */
export function smoothFaceLandmarkSamples(samples, { alpha = 0.45, maxGapMs = 1000 } = {}) {
  const factor = Number(alpha);
  const gapLimit = Number(maxGapMs);
  if (!Number.isFinite(factor) || factor <= 0 || factor > 1
      || !Number.isFinite(gapLimit) || gapLimit < 0) {
    throw new RangeError("alpha must be in (0, 1] and maxGapMs must be non-negative.");
  }
  let previous = null;
  return orderedSamples(samples).map(sample => {
    if (sample.status !== "face-detected" || !isRecord(sample.anchors)) {
      previous = null;
      return { ...sample, anchors: null };
    }
    const canBlend = previous && sample.timestampMs - previous.timestampMs <= gapLimit;
    const anchors = canBlend
      ? blendValue(previous.anchors, sample.anchors, factor)
      : sample.anchors;
    previous = { timestampMs: sample.timestampMs, anchors };
    return { ...sample, anchors };
  });
}

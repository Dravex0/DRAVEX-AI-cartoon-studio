/**
 * Lightweight visual evidence for the free browser QA agent.
 * Pixel changes and orange-color ratios are hints only; they do not recognize
 * characters, objects, or story actions.
 */
export function analyzeRgbaFrameSequence(frames, {
  pixelDeltaThreshold = 18,
  staticMeanChangeThreshold = 0.01,
  staticChangedPixelRatioThreshold = 0.01,
  orangePixelRatioThreshold = 0.01,
  redPixelRatioThreshold = 0.001
} = {}) {
  if (!Array.isArray(frames) || frames.length < 2 || frames.length > 12) {
    throw new RangeError('frames must contain between 2 and 12 samples.');
  }
  if (!Number.isFinite(pixelDeltaThreshold) || pixelDeltaThreshold < 1 || pixelDeltaThreshold > 255) {
    throw new RangeError('pixelDeltaThreshold must be between 1 and 255.');
  }
  const normalized = frames.map((frame, index) => {
    const width = Number(frame?.width);
    const height = Number(frame?.height);
    const data = frame?.data;
    if (!Number.isInteger(width) || width < 1 || width > 512
      || !Number.isInteger(height) || height < 1 || height > 512) {
      throw new TypeError('Frame ' + (index + 1) + ' has invalid dimensions.');
    }
    if (!Array.isArray(data) && !ArrayBuffer.isView(data)) {
      throw new TypeError('Frame ' + (index + 1) + ' must contain RGBA pixel data.');
    }
    if (data.length !== width * height * 4) {
      throw new RangeError('Frame ' + (index + 1) + ' pixel data length does not match its dimensions.');
    }
    return { width, height, data };
  });
  const width = normalized[0].width;
  const height = normalized[0].height;
  if (normalized.some(frame => frame.width !== width || frame.height !== height)) {
    throw new RangeError('All sampled frames must have identical dimensions.');
  }

  const pixelCount = width * height;
  const orangePixelRatios = normalized.map(frame => {
    let orangePixels = 0;
    for (let offset = 0; offset < frame.data.length; offset += 4) {
      const red = Number(frame.data[offset]);
      const green = Number(frame.data[offset + 1]);
      const blue = Number(frame.data[offset + 2]);
      if (red >= 160 && green >= 60 && green <= 190 && blue <= 120
        && red - green >= 35 && red - blue >= 60) orangePixels += 1;
    }
    return Number((orangePixels / pixelCount).toFixed(4));
  });
  const redPixelRatios = normalized.map(frame => {
    let redPixels = 0;
    for (let offset = 0; offset < frame.data.length; offset += 4) {
      const red = Number(frame.data[offset]);
      const green = Number(frame.data[offset + 1]);
      const blue = Number(frame.data[offset + 2]);
      if (red >= 160 && green <= 95 && blue <= 95
        && red - green >= 70 && red - blue >= 70) redPixels += 1;
    }
    return Number((redPixels / pixelCount).toFixed(4));
  });

  let totalChannelChange = 0;
  let changedPixels = 0;
  let comparisons = 0;
  for (let frameIndex = 1; frameIndex < normalized.length; frameIndex += 1) {
    const previous = normalized[frameIndex - 1].data;
    const current = normalized[frameIndex].data;
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const offset = pixel * 4;
      const redDelta = Math.abs(Number(current[offset]) - Number(previous[offset]));
      const greenDelta = Math.abs(Number(current[offset + 1]) - Number(previous[offset + 1]));
      const blueDelta = Math.abs(Number(current[offset + 2]) - Number(previous[offset + 2]));
      totalChannelChange += redDelta + greenDelta + blueDelta;
      if (Math.max(redDelta, greenDelta, blueDelta) >= pixelDeltaThreshold) changedPixels += 1;
      comparisons += 1;
    }
  }
  const meanPixelChange = comparisons
    ? totalChannelChange / (comparisons * 3 * 255)
    : 0;
  const changedPixelRatio = comparisons ? changedPixels / comparisons : 0;
  const status = meanPixelChange < staticMeanChangeThreshold
    && changedPixelRatio < staticChangedPixelRatioThreshold
    ? 'likely-static'
    : 'visible-change';
  const maxOrangePixelRatio = Math.max(0, ...orangePixelRatios);
  const maxRedPixelRatio = Math.max(0, ...redPixelRatios);
  return {
    status,
    frameCount: normalized.length,
    meanPixelChange: Number(meanPixelChange.toFixed(5)),
    changedPixelRatio: Number(changedPixelRatio.toFixed(4)),
    orangePixelRatios,
    maxOrangePixelRatio: Number(maxOrangePixelRatio.toFixed(4)),
    orangeSignal: maxOrangePixelRatio >= orangePixelRatioThreshold
      ? 'orange-pixels-detected'
      : 'low-orange-pixel-signal',
    redPixelRatios,
    maxRedPixelRatio: Number(maxRedPixelRatio.toFixed(4)),
    redSignal: maxRedPixelRatio >= redPixelRatioThreshold
      ? 'red-pixels-detected'
      : 'low-red-pixel-signal',
    note: 'Pixel changes and orange/red color ratios are heuristics only; they do not identify a character, object, or action.'
  };
}

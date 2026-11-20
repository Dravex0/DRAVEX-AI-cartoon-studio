/**
 * Estimate where pixel changes are concentrated in a sampled video.
 * This is a spatial pixel heuristic: it cannot identify a character or distinguish
 * character motion from camera motion, particles, lighting, or scene cuts.
 */
export function analyzeSpatialPixelChange(frames, {
  width = 32,
  height = 32,
  columns = 3,
  rows = 3,
  pixelDeltaThreshold = 0.06,
  activeRegionThreshold = 0.008,
  changedPixelThreshold = 0.01
} = {}) {
  if (!Array.isArray(frames) || frames.length < 2 || frames.length > 12) {
    throw new RangeError("frames must contain between 2 and 12 samples.");
  }
  if (![width, height].every(value => Number.isInteger(value) && value > 0 && value <= 128)) {
    throw new RangeError("width and height must be integers from 1 to 128.");
  }
  if (![columns, rows].every(value => Number.isInteger(value) && value > 0 && value <= 8)
      || columns > width || rows > height) {
    throw new RangeError("The spatial grid must fit inside the sampled frame.");
  }
  if (![pixelDeltaThreshold, activeRegionThreshold, changedPixelThreshold]
      .every(value => Number.isFinite(value) && value >= 0 && value <= 1)) {
    throw new RangeError("Motion thresholds must be finite numbers from 0 to 1.");
  }
  const pixelCount = width * height;
  const samples = frames.map((frame, index) => {
    if (!frame || typeof frame.length !== "number" || frame.length !== pixelCount) {
      throw new TypeError("Frame " + (index + 1) + " must contain exactly width × height luminance values.");
    }
    return frame;
  });

  const regions = Array.from({ length: rows * columns }, (_, index) => ({
    row: Math.floor(index / columns),
    column: index % columns,
    totalChange: 0,
    changedPixels: 0,
    comparisons: 0
  }));
  let totalChange = 0;
  let changedPixels = 0;
  let comparisons = 0;

  for (let frameIndex = 1; frameIndex < samples.length; frameIndex += 1) {
    const previous = samples[frameIndex - 1];
    const current = samples[frameIndex];
    for (let y = 0; y < height; y += 1) {
      const row = Math.min(rows - 1, Math.floor(y * rows / height));
      for (let x = 0; x < width; x += 1) {
        const column = Math.min(columns - 1, Math.floor(x * columns / width));
        const region = regions[row * columns + column];
        const offset = y * width + x;
        const delta = Math.abs(Number(current[offset]) - Number(previous[offset]));
        if (!Number.isFinite(delta)) throw new TypeError("Frame luminance values must be finite numbers.");
        totalChange += delta;
        region.totalChange += delta;
        if (delta >= pixelDeltaThreshold) {
          changedPixels += 1;
          region.changedPixels += 1;
        }
        comparisons += 1;
        region.comparisons += 1;
      }
    }
  }

  const normalized = regions.map(region => {
    const meanChange = region.comparisons ? region.totalChange / region.comparisons : 0;
    const changedPixelRatio = region.comparisons ? region.changedPixels / region.comparisons : 0;
    return {
      row: region.row,
      column: region.column,
      meanChange: Number(meanChange.toFixed(5)),
      changedPixelRatio: Number(changedPixelRatio.toFixed(4)),
      active: meanChange >= activeRegionThreshold && changedPixelRatio >= changedPixelThreshold
    };
  });
  const active = normalized.filter(region => region.active);
  const regionChangeTotal = regions.reduce((sum, region) => sum + region.totalChange, 0);
  const dominant = [...regions].sort((a, b) => b.totalChange - a.totalChange)[0];
  const dominantRegionShare = regionChangeTotal > 0 ? dominant.totalChange / regionChangeTotal : 0;
  const activeCount = active.length;
  const totalRegions = normalized.length;
  let pattern = "no-change";
  if (activeCount > 0) {
    if (activeCount <= Math.max(1, Math.floor(totalRegions / 3)) && dominantRegionShare >= 0.4) {
      pattern = "localized-change";
    } else if (activeCount >= Math.ceil(totalRegions * 2 / 3)) {
      pattern = "distributed-change";
    } else {
      pattern = "mixed-change";
    }
  }

  return {
    pattern,
    rows,
    columns,
    activeRegionCount: activeCount,
    totalRegionCount: totalRegions,
    dominantRegion: regionChangeTotal > 0
      ? { row: dominant.row, column: dominant.column }
      : null,
    dominantRegionShare: Number(dominantRegionShare.toFixed(4)),
    regions: normalized,
    limitations: [
      "Localized change is not proof of character movement.",
      "Camera motion, scene cuts, lighting, particles, and background animation can affect the result."
    ]
  };
}

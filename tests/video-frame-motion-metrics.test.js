import test from "node:test";
import assert from "node:assert/strict";
import { analyzeVideoFrameSequence, compareVideoFrames } from "../src/video-frame-motion-metrics.js";

const solid = (r, g, b, count = 4) => {
  const pixels = new Uint8ClampedArray(count * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = r;
    pixels[offset + 1] = g;
    pixels[offset + 2] = b;
    pixels[offset + 3] = 255;
  }
  return pixels;
};

test("identical frames are classified as low pixel change", () => {
  const result = compareVideoFrames(solid(40, 80, 120), solid(40, 80, 120));
  assert.equal(result.changedPixels, 0);
  assert.equal(result.meanAbsoluteDifference, 0);
  assert.equal(result.classification, "low-pixel-change");
});

test("a zero pixel threshold does not mark identical pixels as changed", () => {
  const frame = solid(40, 80, 120);
  const result = compareVideoFrames(frame, frame.slice(), { pixelThreshold: 0 });
  assert.equal(result.changedPixels, 0);
  assert.equal(result.changedPixelRatio, 0);
  assert.equal(result.classification, "low-pixel-change");
});

test("detects RGB changes and reports changed-pixel ratio", () => {
  const result = compareVideoFrames(solid(255, 0, 0), solid(0, 76, 0));
  assert.equal(result.changedPixelRatio, 1);
  assert.equal(result.classification, "pixel-change-detected");
});

test("sequence report aggregates adjacent-frame comparisons", () => {
  const result = analyzeVideoFrameSequence([
    solid(0, 0, 0),
    solid(0, 0, 0),
    solid(100, 100, 100)
  ]);
  assert.equal(result.frameCount, 3);
  assert.equal(result.comparisonCount, 2);
  assert.equal(result.comparisons[0].classification, "low-pixel-change");
  assert.equal(result.comparisons[1].classification, "pixel-change-detected");
  assert.equal(result.classification, "pixel-change-detected");
});

test("one frame is insufficient to estimate motion", () => {
  const result = analyzeVideoFrameSequence([solid(0, 0, 0)]);
  assert.equal(result.classification, "insufficient-frames");
  assert.equal(result.comparisonCount, 0);
});

test("rejects malformed buffers, different dimensions and invalid thresholds", () => {
  assert.throws(() => compareVideoFrames([1, 2, 3], [1, 2, 3]), /RGBA/);
  assert.throws(() => compareVideoFrames(solid(0, 0, 0), solid(0, 0, 0, 2)), /identical dimensions/);
  assert.throws(() => compareVideoFrames(solid(0, 0, 0), solid(0, 0, 0), { pixelThreshold: 300 }), /between 0 and 255/);
});


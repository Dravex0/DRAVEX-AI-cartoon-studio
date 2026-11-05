import test from "node:test";
import assert from "node:assert/strict";
import { sampleFaceLandmarkTimeline, smoothFaceLandmarkSamples } from "../src/face-landmark-timeline.js";

const face = (x, mouthOpenRatio = 0.2) => ({
  coordinateSpace: "normalized-image",
  mouthCenter: { x, y: 0.6 },
  mouthOpenRatio
});

test("interpolates normalized facial anchors between adjacent detected frames", () => {
  const samples = [
    { timestampMs: 100, status: "face-detected", anchors: face(0.2, 0.1) },
    { timestampMs: 300, status: "face-detected", anchors: face(0.6, 0.5) }
  ];
  const result = sampleFaceLandmarkTimeline(samples, 200);
  assert.equal(result.status, "face-detected");
  assert.equal(result.interpolated, true);
  assert.equal(result.anchors.mouthCenter.x, 0.4);
  assert.ok(Math.abs(result.anchors.mouthOpenRatio - 0.3) < 1e-9);
  assert.equal(result.anchors.coordinateSpace, "normalized-image");
});

test("does not interpolate across a no-face sample", () => {
  const samples = [
    { timestampMs: 0, status: "face-detected", anchors: face(0.2) },
    { timestampMs: 500, status: "no-face", anchors: null },
    { timestampMs: 1000, status: "face-detected", anchors: face(0.8) }
  ];
  assert.equal(sampleFaceLandmarkTimeline(samples, 250).status, "no-face");
  assert.equal(sampleFaceLandmarkTimeline(samples, 750).status, "no-face");
  assert.equal(sampleFaceLandmarkTimeline(samples, 500).status, "no-face");
});

test("rejects out-of-range timestamps and large interpolation gaps", () => {
  const samples = [
    { timestampMs: 100, status: "face-detected", anchors: face(0.2) },
    { timestampMs: 2100, status: "face-detected", anchors: face(0.8) }
  ];
  assert.equal(sampleFaceLandmarkTimeline(samples, 50).status, "out-of-range");
  assert.equal(sampleFaceLandmarkTimeline(samples, 1000, { maxGapMs: 500 }).status, "gap-too-large");
});

test("returns exact detected samples without interpolation", () => {
  const samples = [{ timestampMs: 400, status: "face-detected", anchors: face(0.4) }];
  const result = sampleFaceLandmarkTimeline(samples, 400);
  assert.equal(result.status, "face-detected");
  assert.equal(result.interpolated, false);
  assert.equal(result.anchors.mouthCenter.x, 0.4);
});

test("smooths numeric anchor coordinates and resets at missing faces", () => {
  const samples = [
    { timestampMs: 0, status: "face-detected", anchors: face(0.2) },
    { timestampMs: 100, status: "face-detected", anchors: face(0.6) },
    { timestampMs: 200, status: "no-face", anchors: null },
    { timestampMs: 300, status: "face-detected", anchors: face(0.9) }
  ];
  const result = smoothFaceLandmarkSamples(samples, { alpha: 0.5 });
  assert.equal(result[1].anchors.mouthCenter.x, 0.4);
  assert.equal(result[2].anchors, null);
  assert.equal(result[3].anchors.mouthCenter.x, 0.9);
});

test("smoothing resets after a temporal gap and validates options", () => {
  const samples = [
    { timestampMs: 0, status: "face-detected", anchors: face(0.2) },
    { timestampMs: 2000, status: "face-detected", anchors: face(0.8) }
  ];
  const result = smoothFaceLandmarkSamples(samples, { alpha: 0.5, maxGapMs: 500 });
  assert.equal(result[1].anchors.mouthCenter.x, 0.8);
  assert.throws(() => smoothFaceLandmarkSamples(samples, { alpha: 0 }), /alpha/);
});

test("sorts samples by timestamp before sampling and smoothing", () => {
  const samples = [
    { timestampMs: 300, status: "face-detected", anchors: face(0.6) },
    { timestampMs: 100, status: "face-detected", anchors: face(0.2) }
  ];
  assert.equal(sampleFaceLandmarkTimeline(samples, 200).anchors.mouthCenter.x, 0.4);
  const smoothed = smoothFaceLandmarkSamples(samples, { alpha: 0.5 });
  assert.deepEqual(smoothed.map(sample => sample.timestampMs), [100, 300]);
});

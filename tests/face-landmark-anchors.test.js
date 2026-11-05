import test from "node:test";
import assert from "node:assert/strict";
import { deriveFaceLandmarkAnchors, FACE_LANDMARK_ANCHOR_INDICES } from "../src/face-landmark-anchors.js";

function makeLandmarks() {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const points = {
    forehead: [0.5, 0.15], chin: [0.5, 0.85],
    leftEye: [0.35, 0.38], rightEye: [0.65, 0.38],
    leftCheek: [0.2, 0.5], rightCheek: [0.8, 0.5],
    upperLip: [0.5, 0.62], lowerLip: [0.5, 0.68],
    leftMouthCorner: [0.4, 0.65], rightMouthCorner: [0.6, 0.65]
  };
  for (const [name, [x, y]] of Object.entries(points)) {
    landmarks[FACE_LANDMARK_ANCHOR_INDICES[name]] = { x, y, z: 0 };
  }
  return landmarks;
}

test("derives normalized face, eye, and mouth anchors from a detected face", () => {
  const result = deriveFaceLandmarkAnchors(makeLandmarks());
  assert.equal(result.status, "ready");
  assert.equal(result.anchors.coordinateSpace, "normalized-image");
  assert.deepEqual(result.anchors.mouthCenter, { x: 0.5, y: 0.65 });
  assert.ok(Math.abs(result.anchors.mouthOpenRatio - 0.3) < 1e-9);
  assert.ok(Math.abs(result.anchors.mouthWidthRatio - 1 / 3) < 1e-9);
  assert.ok(Math.abs(result.anchors.faceBounds.x - 0.2) < 1e-9);
  assert.ok(Math.abs(result.anchors.faceBounds.width - 0.6) < 1e-9);
  assert.ok(Math.abs(result.anchors.headRotation) < 1e-9);
});

test("rejects missing or malformed landmark input", () => {
  assert.equal(deriveFaceLandmarkAnchors(null).status, "invalid");
  assert.equal(deriveFaceLandmarkAnchors([]).status, "invalid");
  const landmarks = makeLandmarks();
  landmarks[FACE_LANDMARK_ANCHOR_INDICES.upperLip] = { x: NaN, y: 0.2 };
  assert.equal(deriveFaceLandmarkAnchors(landmarks).status, "invalid");
});

test("rejects degenerate face geometry instead of producing unstable anchors", () => {
  const landmarks = makeLandmarks();
  for (const index of Object.values(FACE_LANDMARK_ANCHOR_INDICES)) {
    landmarks[index] = { x: 0.5, y: 0.5 };
  }
  assert.equal(deriveFaceLandmarkAnchors(landmarks).status, "invalid");
});

test("preserves out-of-frame coordinates for partially cropped faces", () => {
  const landmarks = makeLandmarks();
  landmarks[FACE_LANDMARK_ANCHOR_INDICES.leftCheek] = { x: -0.08, y: 0.5 };
  const result = deriveFaceLandmarkAnchors(landmarks);
  assert.equal(result.status, "ready");
  assert.ok(Math.abs(result.anchors.faceBounds.x + 0.08) < 1e-9);
});

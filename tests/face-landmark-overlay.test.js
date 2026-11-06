import test from "node:test";
import assert from "node:assert/strict";
import { projectFaceLandmarkOverlay } from "../src/face-landmark-overlay.js";

const anchors = {
  faceBounds: { x: 0.35, y: 0.2, width: 0.3, height: 0.5 },
  eyeCenter: { x: 0.5, y: 0.38 },
  mouthCenter: { x: 0.5, y: 0.58 },
  points: {
    leftEye: { x: 0.43, y: 0.37 },
    rightEye: { x: 0.57, y: 0.37 }
  }
};

test("projects face bounds and facial points into a portrait scene canvas", () => {
  const result = projectFaceLandmarkOverlay(anchors, 1920, 1080, 720, 1280);
  assert.equal(result.status, "ready");
  assert.equal(result.overlay.coordinateSpace, "scene-canvas");
  assert.ok(result.overlay.bounds.width > 0);
  assert.ok(result.overlay.bounds.height > 0);
  assert.ok(Math.abs(result.overlay.eyeCenter.x - 360) < 1e-9);
  assert.ok(Math.abs(result.overlay.eyeCenter.y - 486.4) < 1e-9);
  assert.ok(result.overlay.mouthCenter.y > result.overlay.eyeCenter.y);
});

test("includes cover crop and outer camera motion in overlay geometry", () => {
  const result = projectFaceLandmarkOverlay(anchors, 1920, 1080, 720, 1280, {
    cover: { zoom: 1.08, panX: 0.2, panY: -0.1 },
    camera: { zoom: 1.1, offsetY: 12, focusX: 360, focusY: 640 }
  });
  assert.equal(result.status, "ready");
  assert.ok(Number.isFinite(result.overlay.bounds.x));
  assert.ok(Number.isFinite(result.overlay.bounds.y));
  assert.ok(result.overlay.leftEye.x < result.overlay.rightEye.x);
});

test("rejects missing, non-finite, or degenerate face geometry", () => {
  assert.equal(projectFaceLandmarkOverlay(null, 1920, 1080, 720, 1280).status, "invalid-anchors");
  assert.equal(projectFaceLandmarkOverlay({ ...anchors, faceBounds: { x: 0, y: 0, width: 0, height: 1 } }, 1920, 1080, 720, 1280).status, "invalid-anchors");
  assert.equal(projectFaceLandmarkOverlay({ ...anchors, eyeCenter: null }, 1920, 1080, 720, 1280).status, "invalid-anchors");
});

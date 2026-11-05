import test from "node:test";
import assert from "node:assert/strict";
import {
  mapNormalizedImagePointToCoverViewport,
  mapCoverViewportPointToSceneCanvas,
  mapNormalizedImagePointToSceneCanvas
} from "../src/face-landmark-projection.js";

test("maps normalized points through a landscape-to-portrait cover crop", () => {
  const result = mapNormalizedImagePointToCoverViewport(
    { x: 0.5, y: 0.5 }, 1920, 1080, 720, 1280
  );
  assert.equal(result.status, "mapped");
  assert.ok(Math.abs(result.point.x - 360) < 1e-9);
  assert.ok(Math.abs(result.point.y - 640) < 1e-9);
  assert.equal(result.coordinateSpace, "cover-viewport");
  assert.ok(Math.abs(result.crop.sx - 656.25) < 1e-9);
});

test("maps normalized points through a portrait-to-landscape cover crop", () => {
  const result = mapNormalizedImagePointToCoverViewport(
    { x: 0.5, y: 0.5 }, 1000, 1500, 1280, 720
  );
  assert.equal(result.status, "mapped");
  assert.ok(Math.abs(result.point.x - 640) < 1e-9);
  assert.ok(Math.abs(result.point.y - 360) < 1e-9);
  assert.ok(Math.abs(result.crop.sy - 468.75) < 1e-9);
});

test("cover zoom and pan are included in the source-to-viewport mapping", () => {
  const options = { zoom: 1.15, panX: 0.4, panY: -0.3 };
  const result = mapNormalizedImagePointToCoverViewport(
    { x: 0.72, y: 0.35 }, 1920, 1080, 720, 1280, options
  );
  const sourceX = 0.72 * 1920;
  const sourceY = 0.35 * 1080;
  assert.ok(Math.abs(result.point.x - ((sourceX - result.crop.sx) / result.crop.sw * 720)) < 1e-9);
  assert.ok(Math.abs(result.point.y - ((sourceY - result.crop.sy) / result.crop.sh * 1280)) < 1e-9);
});

test("outer camera mapping matches the canvas translate-scale-translate order", () => {
  const result = mapCoverViewportPointToSceneCanvas(
    { x: 500, y: 300 }, 720, 1280,
    { zoom: 1.2, offsetY: 18, focusX: 360, focusY: 640 }
  );
  assert.equal(result.status, "mapped");
  assert.ok(Math.abs(result.point.x - 528) < 1e-9);
  assert.ok(Math.abs(result.point.y - 250) < 1e-9);
  assert.equal(result.coordinateSpace, "scene-canvas");
});

test("combined mapping applies cover crop before the outer scene camera", () => {
  const result = mapNormalizedImagePointToSceneCanvas(
    { x: 0.5, y: 0.5 }, 1920, 1080, 720, 1280,
    { camera: { zoom: 1.1, offsetY: 12, focusX: 360, focusY: 640 } }
  );
  assert.equal(result.status, "mapped");
  assert.ok(Math.abs(result.point.x - 360) < 1e-9);
  assert.ok(Math.abs(result.point.y - 652) < 1e-9);
  assert.deepEqual(result.sourcePoint, { x: 0.5, y: 0.5 });
});

test("invalid points, dimensions, and camera zoom fail closed", () => {
  assert.equal(mapNormalizedImagePointToCoverViewport(null, 100, 100, 100, 100).status, "invalid-point");
  assert.equal(mapNormalizedImagePointToCoverViewport({ x: NaN, y: 0.5 }, 100, 100, 100, 100).status, "invalid-point");
  assert.equal(mapNormalizedImagePointToCoverViewport({ x: 0.5, y: 0.5 }, 0, 100, 100, 100).status, "invalid-dimensions");
  assert.equal(mapCoverViewportPointToSceneCanvas({ x: 1, y: 1 }, 100, 100, { zoom: 0 }).status, "invalid-camera");
  assert.equal(mapCoverViewportPointToSceneCanvas({ x: 1, y: 1 }, 0, 100).status, "invalid-dimensions");
});

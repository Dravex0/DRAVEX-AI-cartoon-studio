import test from "node:test";
import assert from "node:assert/strict";
import {
  getCharacterLayerBounds,
  getCharacterRigBounds,
  unionCharacterBounds,
  sampleCanvasRegion,
  analyzeCharacterRegionFrames,
  buildCompositedCharacterRegions
} from "../src/scene-character-region.js";

test("maps a sprite layer into final canvas coordinates with camera zoom and offset", () => {
  const bounds = getCharacterLayerBounds(
    { x: 0.5, y: 0.5, width: 0.2, height: 0.4 },
    { width: 1000, height: 500 },
    { zoom: 2, focusX: 500, focusY: 250, offsetY: 10 }
  );
  assert.deepEqual(bounds, { x: 300, y: 60, width: 400, height: 400 });
});

test("includes rotation when calculating the axis-aligned character bounds", () => {
  const bounds = getCharacterLayerBounds(
    { x: 0.5, y: 0.5, width: 0.4, height: 0.2, rotation: Math.PI / 2 },
    { width: 100, height: 100 }
  );
  assert.ok(Math.abs(bounds.width - 20) < 1e-8);
  assert.ok(Math.abs(bounds.height - 40) < 1e-8);
});

test("clips character regions to the canvas and ignores invisible or invalid layers", () => {
  const clipped = getCharacterLayerBounds(
    { x: 0.02, y: 0.5, width: 0.2, height: 0.2 },
    { width: 100, height: 100 }
  );
  assert.equal(clipped.x, 0);
  assert.equal(clipped.width, 12);
  assert.equal(getCharacterLayerBounds({ x: 0.5, y: 0.5, width: 0.2, height: 0.2, visible: false }, { width: 100, height: 100 }), null);
  assert.equal(getCharacterLayerBounds({ x: 0.5, y: 0.5, width: 0, height: 0.2 }, { width: 100, height: 100 }), null);
});

test("unions valid rig-part bounds into one character region", () => {
  const bounds = getCharacterRigBounds([
    { x: 0.4, y: 0.5, width: 0.1, height: 0.2 },
    { x: 0.6, y: 0.5, width: 0.1, height: 0.2 }
  ], { width: 100, height: 100 });
  assert.deepEqual(bounds, { x: 35, y: 40, width: 30, height: 20 });
  assert.deepEqual(unionCharacterBounds([bounds, null]), bounds);
  assert.equal(getCharacterRigBounds([], { width: 100, height: 100 }), null);
});

test("samples only the requested crop from the already-composited canvas", () => {
  let drawArgs;
  const source = { width: 200, height: 100 };
  const factory = () => ({
    getContext: () => ({
      drawImage: (...args) => { drawArgs = args; },
      getImageData: () => ({ width: 16, height: 16, data: new Uint8ClampedArray(16 * 16 * 4) })
    })
  });
  const sample = sampleCanvasRegion(source, { x: 10, y: 20, width: 40, height: 30 }, { width: 16, height: 16, canvasFactory: factory });
  assert.equal(sample.width, 16);
  assert.deepEqual(drawArgs.slice(1), [10, 20, 40, 30, 0, 0, 16, 16]);
});

function makeFrame(level, width = 2, height = 2) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = level;
    data[i * 4 + 1] = level;
    data[i * 4 + 2] = level;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

test("flags stable composited character-region frames as likely static", () => {
  const report = analyzeCharacterRegionFrames([makeFrame(90), makeFrame(90), makeFrame(90)]);
  assert.equal(report.status, "likely-static");
  assert.equal(report.meanPixelChange, 0);
  assert.equal(report.region, "composited-character-region");
});

test("detects RGB changes inside the character region", () => {
  const report = analyzeCharacterRegionFrames([makeFrame(0), makeFrame(180)]);
  assert.equal(report.status, "visible-change");
  assert.ok(report.meanPixelChange > 0.06);
  assert.match(report.limitation, /does not prove a semantic character action/);
});

test("rejects mismatched frame dimensions and unsafe thresholds", () => {
  assert.throws(() => analyzeCharacterRegionFrames([makeFrame(0), makeFrame(1, 1, 2)]), /identical dimensions/);
  assert.throws(() => analyzeCharacterRegionFrames([makeFrame(0), makeFrame(1)], { pixelDeltaThreshold: -1 }), /thresholds/);
});


test("builds camera-transformed character regions from the live sprite action pose", () => {
  const regions = buildCompositedCharacterRegions({
    layers: [{ characterId: "Hero", x: 0.5, y: 0.5, width: 0.2, height: 0.4 }],
    motionTimeline: {
      schemaVersion: 1,
      phases: [{ actorId: "hero", start: 0, end: 1, motion: { from: { x: 0.5 }, to: { x: 0.7 } } }]
    },
    progress: 1,
    viewport: { width: 100, height: 100 },
    camera: { zoom: 1, focusX: 50, focusY: 50 }
  });
  assert.equal(regions.length, 1);
  assert.equal(regions[0].characterId, "Hero");
  assert.equal(regions[0].source, "sprite");
  assert.deepEqual(regions[0].bounds, { x: 60, y: 30, width: 20, height: 40 });
});

test("combines sprite and posed rig bounds for the same character", () => {
  const regions = buildCompositedCharacterRegions({
    layers: [{ characterId: "Hero", x: 0.5, y: 0.5, width: 0.2, height: 0.2 }],
    characterRigs: [{
      schemaVersion: 1,
      characterId: "hero",
      bones: [{ id: "root", parentId: null }],
      parts: [{ id: "body", boneId: "root", imageUrl: "https://example.com/body.png", x: 0.2, y: 0.5, width: 0.1, height: 0.2 }]
    }],
    rigPoses: { HERO: { root: { x: 0.2 } } },
    viewport: { width: 100, height: 100 }
  });
  assert.equal(regions.length, 1);
  assert.equal(regions[0].source, "sprite+rig");
  assert.deepEqual(regions[0].bounds, { x: 40, y: 40, width: 20, height: 20 });
});

test("ignores invalid rig definitions and hidden sprite layers", () => {
  const regions = buildCompositedCharacterRegions({
    layers: [{ characterId: "Hidden", x: 0.5, y: 0.5, width: 0.2, height: 0.2, visible: false }],
    characterRigs: [{ schemaVersion: 99, characterId: "Broken", bones: [], parts: [] }],
    viewport: { width: 100, height: 100 }
  });
  assert.deepEqual(regions, []);
});

test("scales logical crop coordinates to the backing canvas pixel dimensions", () => {
  let drawArgs;
  const factory = () => ({
    getContext: () => ({
      drawImage: (...args) => { drawArgs = args; },
      getImageData: () => ({ width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4) })
    })
  });
  sampleCanvasRegion(
    { width: 400, height: 200 },
    { x: 10, y: 5, width: 20, height: 15 },
    { width: 8, height: 8, scaleX: 2, scaleY: 2, canvasFactory: factory }
  );
  assert.deepEqual(drawArgs.slice(1), [20, 10, 40, 30, 0, 0, 8, 8]);
});

import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSpatialPixelChange } from "../src/scene-motion-spatial.js";

function framesWithRegions(width, height, changedRegions, rows = 2, columns = 2) {
  const frames = [new Float32Array(width * height), new Float32Array(width * height)];
  for (const [row, column] of changedRegions) {
    const startX = Math.floor(column * width / columns);
    const endX = Math.floor((column + 1) * width / columns);
    const startY = Math.floor(row * height / rows);
    const endY = Math.floor((row + 1) * height / rows);
    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        frames[1][y * width + x] = 0.5;
      }
    }
  }
  return frames;
}

test("reports no spatial motion for unchanged frames", () => {
  const report = analyzeSpatialPixelChange([new Float32Array(64), new Float32Array(64)], {
    width: 8, height: 8, rows: 2, columns: 2
  });
  assert.equal(report.pattern, "no-change");
  assert.equal(report.activeRegionCount, 0);
  assert.equal(report.dominantRegion, null);
});

test("detects a localized region of pixel change without calling it character motion", () => {
  const report = analyzeSpatialPixelChange(framesWithRegions(8, 8, [[0, 0]]), {
    width: 8, height: 8, rows: 2, columns: 2
  });
  assert.equal(report.pattern, "localized-change");
  assert.equal(report.activeRegionCount, 1);
  assert.deepEqual(report.dominantRegion, { row: 0, column: 0 });
  assert.ok(report.limitations.some(value => value.includes("not proof of character movement")));
});

test("reports distributed change when most regions change", () => {
  const report = analyzeSpatialPixelChange(framesWithRegions(8, 8, [[0, 0], [0, 1], [1, 0]]), {
    width: 8, height: 8, rows: 2, columns: 2
  });
  assert.equal(report.pattern, "distributed-change");
  assert.equal(report.activeRegionCount, 3);
});

test("reports mixed change when several but not most regions change", () => {
  const report = analyzeSpatialPixelChange(framesWithRegions(8, 8, [[0, 0], [1, 1]]), {
    width: 8, height: 8, rows: 2, columns: 2
  });
  assert.equal(report.pattern, "mixed-change");
  assert.equal(report.activeRegionCount, 2);
});

test("validates frame dimensions and grid limits", () => {
  assert.throws(() => analyzeSpatialPixelChange([new Float32Array(4), new Float32Array(4)], {
    width: 3, height: 2
  }), /exactly width/);
  assert.throws(() => analyzeSpatialPixelChange([new Float32Array(64), new Float32Array(64)], {
    width: 8, height: 8, rows: 9, columns: 2
  }), /grid/);
});

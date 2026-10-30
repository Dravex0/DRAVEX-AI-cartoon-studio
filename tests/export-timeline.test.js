import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExportTimeline } from '../src/export-timeline.js';

test('creates contiguous scene segments using each scene duration', () => {
  const result = buildExportTimeline([
    { durationSeconds: 2 },
    { durationSeconds: 3.5 },
    { durationSeconds: 1 }
  ], 4);
  assert.deepEqual(result.segments.map(({ sceneIndex, startMs, endMs }) => ({ sceneIndex, startMs, endMs })), [
    { sceneIndex: 0, startMs: 0, endMs: 2000 },
    { sceneIndex: 1, startMs: 2000, endMs: 5500 },
    { sceneIndex: 2, startMs: 5500, endMs: 6500 }
  ]);
  assert.equal(result.totalDurationMs, 6500);
  assert.equal(result.totalDurationSeconds, 6.5);
});

test('uses the selected default for scenes without a valid duration', () => {
  const result = buildExportTimeline([
    {},
    { durationSeconds: null },
    { duration: 'invalid' },
    { durationSeconds: 1.25 }
  ], 5);
  assert.deepEqual(result.segments.map(item => item.durationMs), [5000, 5000, 5000, 1250]);
  assert.equal(result.totalDurationMs, 16250);
});

test('clamps scene and fallback durations to safe bounds', () => {
  const result = buildExportTimeline([
    { durationSeconds: 0.01 },
    { durationSeconds: 999 }
  ], 0);
  assert.deepEqual(result.segments.map(item => item.durationMs), [250, 30000]);
  assert.equal(result.totalDurationMs, 30250);
});

test('limits export to the editor maximum of twelve scenes', () => {
  const result = buildExportTimeline(Array.from({ length: 15 }, () => ({ durationSeconds: 1 })), 3);
  assert.equal(result.segments.length, 12);
  assert.equal(result.totalDurationMs, 12000);
});

test('accepts empty or malformed scene collections safely', () => {
  assert.deepEqual(buildExportTimeline(null, 3), { segments: [], totalDurationMs: 0, totalDurationSeconds: 0 });
  assert.deepEqual(buildExportTimeline([], 3), { segments: [], totalDurationMs: 0, totalDurationSeconds: 0 });
});

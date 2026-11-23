import test from "node:test";
import assert from "node:assert/strict";
import { summarizeSceneMotionResults } from "../src/scene-motion-results.js";

test("summarizes per-scene motion outcomes", () => {
  const results = new Map([
    ["a", { status: "likely-static" }],
    ["b", { status: "visible-change" }],
    ["c", { status: "skipped" }]
  ]);
  assert.deepEqual(summarizeSceneMotionResults(results), {
    checked: 2, static: 1, changed: 1, skipped: 1, motionTracks: 0, persistentMotionTracks: 0, motionRegionObservations: 0
  });
});

test("ignores missing or unknown result statuses", () => {
  assert.deepEqual(summarizeSceneMotionResults([
    null, {}, { status: "unknown" }, { status: "visible-change" }
  ]), { checked: 1, static: 0, changed: 1, skipped: 0, motionTracks: 0, persistentMotionTracks: 0, motionRegionObservations: 0 });
});

test("accepts an empty result collection", () => {
  assert.deepEqual(summarizeSceneMotionResults([]), {
    checked: 0, static: 0, changed: 0, skipped: 0, motionTracks: 0, persistentMotionTracks: 0, motionRegionObservations: 0
  });
});

test("summarizes anonymous motion regions and persistent tracks", () => {
  assert.deepEqual(summarizeSceneMotionResults([
    { status: 'visible-change', motionTrackCount: 4, persistentMotionTrackCount: 2, motionRegionObservations: 9 },
    { status: 'likely-static', motionTrackCount: 0, persistentMotionTrackCount: 0, motionRegionObservations: 0 }
  ]), {
    checked: 2, static: 1, changed: 1, skipped: 0,
    motionTracks: 4, persistentMotionTracks: 2, motionRegionObservations: 9
  });
});

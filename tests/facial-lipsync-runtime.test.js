import test from "node:test";
import assert from "node:assert/strict";
import { sampleCharacterFacialLipSync } from "../src/facial-lipsync-runtime.js";

function track(characterId, sceneIndex, startMs, shapes, openness) {
  return {
    characterId,
    sceneIndex,
    startMs,
    envelope: { fps: 10, frameCount: openness.length, durationMs: openness.length * 100, frames: openness },
    visemes: { fps: 10, frameCount: shapes.length, durationMs: shapes.length * 100, frames: shapes }
  };
}

test("samples the active dialogue cue into per-character viseme and mouth controls", () => {
  const result = sampleCharacterFacialLipSync([
    track("Foxy", 2, 1000, ["closed", "open", "round"], [0.1, 0.7, 0.4])
  ], 2, 1100);
  assert.deepEqual(result.facialVisemes, { Foxy: "open" });
  assert.ok(Math.abs(result.facialMouthOpenness.Foxy - 0.7) < 1e-9);
  assert.deepEqual(result.activeCharacterIds, ["Foxy"]);
});

test("keeps simultaneous dialogue actors isolated and ignores other scenes", () => {
  const result = sampleCharacterFacialLipSync([
    track("Foxy", 1, 0, ["wide", "wide"], [0.4, 0.4]),
    track("Owl", 1, 50, ["round", "round"], [0.8, 0.8]),
    track("Fox", 2, 0, ["open", "open"], [1, 1])
  ], 1, 75);
  assert.deepEqual(result.facialVisemes, { Foxy: "wide", Owl: "round" });
  assert.deepEqual(result.activeCharacterIds.sort(), ["Foxy", "Owl"]);
});

test("uses the latest-starting active cue when one character has overlapping lines", () => {
  const result = sampleCharacterFacialLipSync([
    track("Foxy", 0, 0, ["wide", "wide", "wide"], [0.2, 0.2, 0.2]),
    track("Foxy", 0, 100, ["round", "round"], [0.9, 0.9])
  ], 0, 150);
  assert.equal(result.facialVisemes.Foxy, "round");
  assert.ok(Math.abs(result.facialMouthOpenness.Foxy - 0.9) < 1e-9);
});

test("returns neutral empty controls outside cue intervals or for malformed input", () => {
  assert.deepEqual(sampleCharacterFacialLipSync([
    track("Foxy", 0, 100, ["open"], [0.8])
  ], 0, 99), { facialVisemes: {}, facialMouthOpenness: {}, activeCharacterIds: [] });
  assert.deepEqual(sampleCharacterFacialLipSync(null, 0, 0), { facialVisemes: {}, facialMouthOpenness: {}, activeCharacterIds: [] });
});

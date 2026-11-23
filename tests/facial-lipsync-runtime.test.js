import test from "node:test";
import assert from "node:assert/strict";
import { findActiveCharacterLipSyncTrack, sampleCharacterFacialLipSync, sceneHasFacialRigForSpeaker } from "../src/facial-lipsync-runtime.js";

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


test("holds a neutral mouth when timestamped visemes overlap effective audio silence", () => {
  const result = sampleCharacterFacialLipSync([
    track("Foxy", 0, 0, ["open", "round", "teeth"], [0, 0.01, 0])
  ], 0, 150);
  assert.equal(result.facialVisemes.Foxy, "neutral");
  assert.equal(result.facialMouthOpenness.Foxy, 0.005);
  assert.deepEqual(result.activeCharacterIds, ["Foxy"]);
});

test("preserves timestamped visemes when the dialogue waveform is audible", () => {
  const result = sampleCharacterFacialLipSync([
    track("Foxy", 0, 0, ["closed", "round"], [0.2, 0.04])
  ], 0, 150);
  assert.equal(result.facialVisemes.Foxy, "round");
  assert.equal(result.facialMouthOpenness.Foxy, 0.04);
});


test("matches facial rigs only to the corresponding dialogue speaker", () => {
  const rigs = [
    { characterId: "Foxy", parts: [{ id: "mouth" }] },
    { characterId: "Owl", characterName: "Old Owl", parts: [{ id: "beak" }] }
  ];
  assert.equal(sceneHasFacialRigForSpeaker(rigs, "Foxy", "Foxy"), true);
  assert.equal(sceneHasFacialRigForSpeaker(rigs, "Owl", "Old Owl"), true);
  assert.equal(sceneHasFacialRigForSpeaker(rigs, "Rabbit", "Rabbit"), false);
  assert.equal(sceneHasFacialRigForSpeaker([], "Foxy", "Foxy"), false);
  assert.equal(sceneHasFacialRigForSpeaker(rigs, "", ""), false);
});

test("does not treat the existence of an unrelated rig as a speaker match", () => {
  const rigs = [{ characterId: "Foxy", parts: [{ id: "mouth" }] }];
  assert.equal(sceneHasFacialRigForSpeaker(rigs, "Owl", "Owl"), false);
});


test("selects the main character mouth track when another speaker is active in the same scene", () => {
  const owl = track("Owl", 0, 0, ["round", "round"], [0.9, 0.9]);
  owl.characterName = "Old Owl";
  const foxy = track("Foxy", 0, 50, ["wide", "open"], [0.6, 0.8]);
  const selected = findActiveCharacterLipSyncTrack([owl, foxy], 0, 100, "Foxy", "Foxy");
  assert.equal(selected, foxy);
});

test("uses the latest active cue for the requested character and ignores other scenes", () => {
  const first = track("Foxy", 0, 0, ["wide", "wide"], [0.4, 0.4]);
  const second = track("Foxy", 0, 50, ["round", "round"], [0.9, 0.9]);
  const otherScene = track("Foxy", 1, 70, ["open", "open"], [1, 1]);
  assert.equal(findActiveCharacterLipSyncTrack([first, otherScene, second], 0, 100, "Foxy"), second);
  assert.equal(findActiveCharacterLipSyncTrack([first], 0, 250, "Foxy"), null);
  assert.equal(findActiveCharacterLipSyncTrack([first], 0, 100, "Owl"), null);
});

import test from "node:test";
import assert from "node:assert/strict";
import { selectRenderableLipSyncTracks } from "../src/lip-sync-track-eligibility.js";

const mouthRig = characterId => ({
  schemaVersion: 1,
  characterId,
  headBoneId: "head",
  parts: [{
    id: "mouth",
    role: "mouth",
    imageUrl: "https://example.com/mouth.png",
    x: 0.5,
    y: 0.6,
    width: 0.1,
    height: 0.05,
    rotation: 0,
    zIndex: 10
  }]
});

const track = (characterName, sceneIndex = 0, characterId = characterName) => ({
  characterName, characterId, sceneIndex
});

test("does not mark a generated main character lip-syncable without a facial mouth rig", () => {
  const result = selectRenderableLipSyncTracks({
    voiceTracks: [track("Foxy")],
    mainCharacterKey: "Foxy",
    storyUsesFallback: false,
    sceneMetadata: [{ characterLayers: [{ characterId: "Foxy" }], characterFacialRigs: [] }]
  });
  assert.deepEqual(result, []);
});

test("keeps the built-in procedural demo character eligible for its Canvas mouth renderer", () => {
  const candidate = track("Foxy");
  const result = selectRenderableLipSyncTracks({
    voiceTracks: [candidate],
    mainCharacterKey: "Foxy",
    storyUsesFallback: true,
    sceneMetadata: [{ characterLayers: [], characterFacialRigs: [] }]
  });
  assert.deepEqual(result, [candidate]);
});

test("requires a valid matching facial rig with a mouth part for generated speakers", () => {
  const candidate = track("Foxy");
  const result = selectRenderableLipSyncTracks({
    voiceTracks: [candidate],
    mainCharacterKey: "Someone else",
    storyUsesFallback: false,
    sceneMetadata: [{ characterLayers: [{ characterId: "Foxy" }], characterFacialRigs: [mouthRig("Foxy")] }]
  });
  assert.deepEqual(result, [candidate]);
});

test("ignores mismatched, invalid, and mouthless facial rigs", () => {
  const candidate = track("Foxy");
  const sceneMetadata = [{
    characterLayers: [{ characterId: "Foxy" }],
    characterFacialRigs: [
      mouthRig("Owl"),
      { ...mouthRig("Foxy"), schemaVersion: 0 },
      { ...mouthRig("Foxy"), parts: [{ ...mouthRig("Foxy").parts[0], role: "eye-left" }] }
    ]
  }];
  const result = selectRenderableLipSyncTracks({
    voiceTracks: [candidate],
    mainCharacterKey: "Foxy",
    storyUsesFallback: false,
    sceneMetadata
  });
  assert.deepEqual(result, []);
});

test("allows a matching valid facial rig even when the speaker is not the main character", () => {
  const candidate = track("Owl");
  const result = selectRenderableLipSyncTracks({
    voiceTracks: [candidate],
    mainCharacterKey: "Foxy",
    storyUsesFallback: false,
    sceneMetadata: [{ characterFacialRigs: [mouthRig("Owl")] }]
  });
  assert.deepEqual(result, [candidate]);
});

test("does not use the procedural demo fallback when a generated character layer exists", () => {
  const candidate = track("Foxy");
  const result = selectRenderableLipSyncTracks({
    voiceTracks: [candidate],
    mainCharacterKey: "Foxy",
    storyUsesFallback: true,
    sceneMetadata: [{ characterLayers: [{ characterId: "Foxy" }], characterFacialRigs: [] }]
  });
  assert.deepEqual(result, []);
});

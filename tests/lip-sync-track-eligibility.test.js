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
    sceneMetadata: [{ characterLayers: [{ characterId: "Foxy", imageUrl: "https://example.com/foxy.png", visible: true }], characterFacialRigs: [] }]
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
    sceneMetadata: [{ characterLayers: [{ characterId: "Foxy", imageUrl: "https://example.com/foxy.png", visible: true }], characterFacialRigs: [] }]
  });
  assert.deepEqual(result, []);
});


test("does not assign the procedural fox mouth to a character already rendered from a body rig", () => {
  const candidate = track("Foxy");
  const bodyRig = {
    schemaVersion: 1,
    characterId: "Foxy",
    bones: [{ id: "root" }],
    parts: [{ id: "body", boneId: "root", imageUrl: "https://example.com/body.png" }]
  };
  const result = selectRenderableLipSyncTracks({
    voiceTracks: [candidate],
    mainCharacterKey: "Foxy",
    storyUsesFallback: true,
    sceneMetadata: [{ characterLayers: [], characterRigs: [bodyRig], characterFacialRigs: [] }]
  });
  assert.deepEqual(result, []);
});


test("keeps the procedural fox lip-sync when only a secondary character layer is present", () => {
  const candidate = track("Foxy");
  const result = selectRenderableLipSyncTracks({
    voiceTracks: [candidate],
    mainCharacterKey: "Foxy",
    storyUsesFallback: true,
    sceneMetadata: [{
      characterLayers: [{ characterId: "Owl", imageUrl: "https://example.com/owl.png", visible: true }],
      characterRigs: [],
      characterFacialRigs: []
    }]
  });
  assert.deepEqual(result, [candidate]);
});

test("keeps the procedural fallback eligible when a character layer has no image asset", () => {
  const candidate = track("Foxy");
  const result = selectRenderableLipSyncTracks({
    voiceTracks: [candidate],
    mainCharacterKey: "Foxy",
    storyUsesFallback: true,
    sceneMetadata: [{ characterLayers: [{ characterId: "Foxy" }], characterFacialRigs: [] }]
  });
  assert.deepEqual(result, [candidate]);
});


test("allows lip sync for a procedural human fallback only when the scene renderer confirms that speaker", () => {
  const candidate = track("Kael");
  const scene = { characters: ["Kael"] };
  const result = selectRenderableLipSyncTracks({
    voiceTracks: [candidate],
    sceneMetadata: [scene],
    canRenderProceduralCharacter: (voiceTrack, currentScene, sceneIndex) =>
      voiceTrack.characterId === "Kael"
      && currentScene.characters.includes("Kael")
      && sceneIndex === 0
  });
  assert.deepEqual(result, [candidate]);
});

test("does not allow a procedural fallback lip sync track for a different or unrendered speaker", () => {
  const kael = track("Kael");
  const nox = track("Nox");
  const result = selectRenderableLipSyncTracks({
    voiceTracks: [kael, nox],
    sceneMetadata: [{ characters: ["Kael", "Nox"] }],
    canRenderProceduralCharacter: voiceTrack => voiceTrack.characterId === "Kael"
  });
  assert.deepEqual(result, [kael]);
});

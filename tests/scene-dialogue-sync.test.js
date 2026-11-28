import test from "node:test";
import assert from "node:assert/strict";
import { syncSceneDialogueDraft } from "../src/scene-dialogue-sync.js";

const dialogue = [{ characterId: "Foxy", text: "Hello!", language: "en" }];
const cues = [{ cueId: "scene-1:dialogue:1", characterId: "Foxy", text: "Hello!", audioHash: "a".repeat(64), durationMs: 500 }];

test("updates edited dialogue and invalidates voice cues generated for the previous text", () => {
  const scene = { id: "scene-1", dialogue: [{ ...dialogue[0], text: "Hi!" }], voiceCues: cues, voiceTimeline: { tracks: cues } };
  const result = syncSceneDialogueDraft(scene, dialogue);
  assert.deepEqual(result.dialogue, dialogue);
  assert.deepEqual(result.voiceCues, []);
  assert.equal(result.voiceTimeline, null);
  assert.equal(scene.voiceCues.length, 1, "the input scene is not mutated");
});

test("preserves matching voice artifacts when dialogue has not changed", () => {
  const scene = { id: "scene-1", dialogue, voiceCues: cues, voiceTimeline: { tracks: cues } };
  const result = syncSceneDialogueDraft(scene, dialogue);
  assert.equal(result, scene);
  assert.equal(result.voiceCues, cues);
});

test("clearing the dialogue editor clears old dialogue and generated audio", () => {
  const scene = { id: "scene-1", dialogue, voiceCues: cues, voiceTimeline: { tracks: cues } };
  const result = syncSceneDialogueDraft(scene, []);
  assert.deepEqual(result.dialogue, []);
  assert.deepEqual(result.voiceCues, []);
  assert.equal(result.voiceTimeline, null);
});

test("removes orphaned voice artifacts when legacy scene metadata has no dialogue", () => {
  const scene = { id: "legacy-scene", voiceCues: cues, voiceTimeline: { tracks: cues } };
  const result = syncSceneDialogueDraft(scene, []);
  assert.deepEqual(result.dialogue, []);
  assert.deepEqual(result.voiceCues, []);
  assert.equal(result.voiceTimeline, null);
});

test("rejects invalid scene and dialogue inputs", () => {
  assert.throws(() => syncSceneDialogueDraft(null, []), /scene object/);
  assert.throws(() => syncSceneDialogueDraft({ id: "scene-1" }, "Foxy: Hello"), /dialogueLines must be an array/);
});

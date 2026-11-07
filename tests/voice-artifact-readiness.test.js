import test from "node:test";
import assert from "node:assert/strict";
import { findScenesWithMissingVoiceAudio } from "../src/voice-artifact-readiness.js";

const HASH = "a".repeat(64);
const makeScene = (overrides = {}) => ({
  id: "scene-1",
  dialogue: [{ characterId: "Narrator", text: "Hello." }],
  voiceCues: [{ cueId: "scene-1:line-1", audioHash: HASH, durationMs: 1000 }],
  ...overrides
});
const makeRecord = (overrides = {}) => {
  const blob = new Blob(["valid-wave-placeholder"], { type: "audio/wav" });
  return {
    audioHash: HASH,
    blob,
    mimeType: "audio/wav",
    durationMs: 1000,
    byteSize: blob.size,
    ...overrides
  };
};
const storageFor = record => ({ get: async hash => hash === HASH ? record : null });

test("accepts a stored voice artifact whose hash, WAV type, size and duration match its cue", async () => {
  assert.deepEqual(
    await findScenesWithMissingVoiceAudio([makeScene()], storageFor(makeRecord())),
    []
  );
});

test("rejects missing or empty audio blobs", async () => {
  assert.deepEqual(
    await findScenesWithMissingVoiceAudio([makeScene()], storageFor(null)),
    [{ sceneId: "scene-1", index: 0 }]
  );
  assert.deepEqual(
    await findScenesWithMissingVoiceAudio([makeScene()], storageFor(makeRecord({ blob: new Blob([]) }))),
    [{ sceneId: "scene-1", index: 0 }]
  );
});

test("rejects a stored record whose hash or byte-size metadata disagrees with its key or Blob", async () => {
  assert.deepEqual(
    await findScenesWithMissingVoiceAudio([makeScene()], storageFor(makeRecord({ audioHash: "b".repeat(64) }))),
    [{ sceneId: "scene-1", index: 0 }]
  );
  assert.deepEqual(
    await findScenesWithMissingVoiceAudio([makeScene()], storageFor(makeRecord({ byteSize: 9999 }))),
    [{ sceneId: "scene-1", index: 0 }]
  );
});

test("rejects non-WAV audio and duration metadata that no longer matches the dialogue cue", async () => {
  assert.deepEqual(
    await findScenesWithMissingVoiceAudio([makeScene()], storageFor(makeRecord({ mimeType: "audio/mpeg" }))),
    [{ sceneId: "scene-1", index: 0 }]
  );
  assert.deepEqual(
    await findScenesWithMissingVoiceAudio([makeScene()], storageFor(makeRecord({ durationMs: 2500 }))),
    [{ sceneId: "scene-1", index: 0 }]
  );
});

test("rejects cues without measured positive durations and mismatched cue counts", async () => {
  const invalidDuration = makeScene({
    voiceCues: [{ cueId: "scene-1:line-1", audioHash: HASH, durationMs: 0 }]
  });
  const mismatchedCount = makeScene({ id: "scene-2", voiceCues: [
    { cueId: "scene-2:line-1", audioHash: HASH, durationMs: 1000 },
    { cueId: "scene-2:line-2", audioHash: HASH, durationMs: 1000 }
  ] });
  assert.deepEqual(
    await findScenesWithMissingVoiceAudio([invalidDuration, mismatchedCount], storageFor(makeRecord())),
    [{ sceneId: "scene-1", index: 0 }, { sceneId: "scene-2", index: 1 }]
  );
});

test("ignores scenes without dialogue or voice cues", async () => {
  assert.deepEqual(
    await findScenesWithMissingVoiceAudio([
      { id: "silent", dialogue: [], voiceCues: [] },
      { id: "not-yet-voiced", dialogue: [{ text: "Hello" }], voiceCues: [] }
    ], storageFor(null)),
    []
  );
});

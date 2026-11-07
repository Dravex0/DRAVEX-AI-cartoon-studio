import test from "node:test";
import assert from "node:assert/strict";
import { createVoiceGenerationCheckpoint, restoreVoiceGenerationCheckpoint } from "../src/voice-generation-checkpoint.js";

const dialogue = [
  { characterId: "hero", text: "Hello there." },
  { characterId: "friend", text: "Welcome back." }
];
const voiceIds = ["af_heart", "af_bella"];
const artifacts = [
  {
    audioHash: "a".repeat(64),
    durationMs: 1250,
    voiceId: "af_heart",
    visemeEvents: [{ shape: "open", startMs: 0, durationMs: 100 }],
    phonemeChunks: [{ text: "Hello there.", phonemes: "həlˈoʊ", startMs: 0, endMs: 1250 }]
  },
  null
];
const context = { sceneId: "scene-1", locale: "en", engine: "kokoro-js", modelId: "kokoro-82m" };
function makeRecord(hash = "a".repeat(64), overrides = {}) {
  const blob = new Blob(["wav-placeholder"], { type: "audio/wav" });
  return {
    audioHash: hash,
    blob,
    mimeType: "audio/wav",
    durationMs: 1250,
    byteSize: blob.size,
    ...overrides
  };
}
function storage(records = new Map([["a".repeat(64), makeRecord()]])) {
  return { async get(hash) { return records.get(hash) || null; } };
}

test("restores only completed lines whose verified WAV blobs still exist", async () => {
  const checkpoint = createVoiceGenerationCheckpoint({ ...context, dialogue, voiceIds, artifacts });
  const restored = await restoreVoiceGenerationCheckpoint({ checkpoint, ...context, dialogue, voiceIds, storage: storage() });
  assert.equal(restored[0].audioHash, "a".repeat(64));
  assert.equal(restored[0].durationMs, 1250);
  assert.deepEqual(restored[0].visemeEvents, artifacts[0].visemeEvents);
  assert.deepEqual(restored[0].phonemeChunks, artifacts[0].phonemeChunks);
  assert.equal(restored[1], null);
});

test("rejects stale dialogue, language, model and voice assignments", async () => {
  const checkpoint = createVoiceGenerationCheckpoint({ ...context, dialogue, voiceIds, artifacts });
  const changed = await restoreVoiceGenerationCheckpoint({
    checkpoint, ...context, dialogue: [{ ...dialogue[0], text: "Changed text" }, dialogue[1]],
    voiceIds, storage: storage()
  });
  assert.deepEqual(changed, [null, null]);
  const wrongLanguage = await restoreVoiceGenerationCheckpoint({
    checkpoint, ...context, locale: "uk", dialogue, voiceIds, storage: storage()
  });
  assert.deepEqual(wrongLanguage, [null, null]);
  const wrongVoice = await restoreVoiceGenerationCheckpoint({
    checkpoint, ...context, dialogue, voiceIds: ["other", "af_bella"], storage: storage()
  });
  assert.deepEqual(wrongVoice, [null, null]);
});

test("does not reuse artifacts whose WAV is missing, empty, mistyped or has a mismatched duration", async () => {
  const checkpoint = createVoiceGenerationCheckpoint({ ...context, dialogue, voiceIds, artifacts });
  assert.deepEqual(await restoreVoiceGenerationCheckpoint({
    checkpoint, ...context, dialogue, voiceIds, storage: storage(new Map())
  }), [null, null]);
  const emptyBlob = new Blob([], { type: "audio/wav" });
  assert.deepEqual(await restoreVoiceGenerationCheckpoint({
    checkpoint, ...context, dialogue, voiceIds,
    storage: storage(new Map([["a".repeat(64), makeRecord(undefined, { blob: emptyBlob, byteSize: 0 })]]))
  }), [null, null]);
  assert.deepEqual(await restoreVoiceGenerationCheckpoint({
    checkpoint, ...context, dialogue, voiceIds,
    storage: storage(new Map([["a".repeat(64), makeRecord("a".repeat(64), { mimeType: "audio/mpeg" })]]))
  }), [null, null]);
  assert.deepEqual(await restoreVoiceGenerationCheckpoint({
    checkpoint, ...context, dialogue, voiceIds,
    storage: storage(new Map([["a".repeat(64), makeRecord("a".repeat(64), { durationMs: 2400 })]]))
  }), [null, null]);
});

test("rejects corrupt viseme and phoneme timing when creating checkpoints", () => {
  assert.throws(() => createVoiceGenerationCheckpoint({
    ...context, dialogue: [dialogue[0]], voiceIds: [voiceIds[0]],
    artifacts: [{ ...artifacts[0], visemeEvents: [{ shape: "unknown", startMs: 0, durationMs: 100 }] }]
  }), /viseme timing/);
  assert.throws(() => createVoiceGenerationCheckpoint({
    ...context, dialogue: [dialogue[0]], voiceIds: [voiceIds[0]],
    artifacts: [{ ...artifacts[0], phonemeChunks: [{ phonemes: "x", startMs: 100, endMs: 50 }] }]
  }), /phoneme chunk timing/);
});

test("ignores corrupted timeline metadata from a manually edited checkpoint", async () => {
  const checkpoint = createVoiceGenerationCheckpoint({ ...context, dialogue, voiceIds, artifacts });
  checkpoint.lines[0].artifact.visemeEvents = [{ shape: "open", startMs: -10, durationMs: 100 }];
  const restored = await restoreVoiceGenerationCheckpoint({
    checkpoint, ...context, dialogue, voiceIds, storage: storage()
  });
  assert.deepEqual(restored, [null, null]);
});

test("rejects a voice artifact assigned to a different character voice", () => {
  assert.throws(() => createVoiceGenerationCheckpoint({
    ...context,
    dialogue: [dialogue[0]],
    voiceIds: [voiceIds[0]],
    artifacts: [{ ...artifacts[0], voiceId: "af_bella" }]
  }), /does not match its resolved speaker assignment/);
});

test("rejects malformed checkpoint construction", () => {
  assert.throws(() => createVoiceGenerationCheckpoint({ ...context, dialogue, voiceIds: ["one"], artifacts }), /voice ID slot/);
  assert.throws(() => createVoiceGenerationCheckpoint({
    ...context, dialogue: [dialogue[0]], voiceIds: ["one"],
    artifacts: [{ audioHash: "bad", durationMs: 1 }]
  }), /SHA-256/);
});

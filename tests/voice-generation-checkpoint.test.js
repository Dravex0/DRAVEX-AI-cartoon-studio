import test from "node:test";
import assert from "node:assert/strict";
import { createVoiceGenerationCheckpoint, restoreVoiceGenerationCheckpoint } from "../src/voice-generation-checkpoint.js";

const dialogue = [
  { characterId: "hero", text: "Hello there." },
  { characterId: "friend", text: "Welcome back." }
];
const voiceIds = ["af_heart", "af_bella"];
const artifacts = [
  { audioHash: "a".repeat(64), durationMs: 1250, voiceId: "af_heart", visemeEvents: [{ shape: "open", startMs: 0, durationMs: 100 }] },
  null
];
const validRecord = (overrides = {}) => {
  const blob = new Blob(["wav"], { type: "audio/wav" });
  return {
    audioHash: "a".repeat(64),
    blob,
    mimeType: "audio/wav",
    durationMs: 1250,
    sampleRate: 24000,
    ...overrides
  };
};
function storage(records = new Map([["a".repeat(64), validRecord()]])) {
  return { async get(hash) { return records.get(hash) || null; } };
}
const context = { sceneId: "scene-1", locale: "en", engine: "kokoro-js", modelId: "kokoro-82m" };

test("restores only completed lines whose WAV metadata matches the checkpoint", async () => {
  const checkpoint = createVoiceGenerationCheckpoint({ ...context, dialogue, voiceIds, artifacts });
  const restored = await restoreVoiceGenerationCheckpoint({ checkpoint, ...context, dialogue, voiceIds, storage: storage() });
  assert.equal(restored[0].audioHash, "a".repeat(64));
  assert.equal(restored[0].durationMs, 1250);
  assert.deepEqual(restored[0].visemeEvents, artifacts[0].visemeEvents);
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

test("does not reuse artifacts whose IndexedDB WAV was evicted or empty", async () => {
  const checkpoint = createVoiceGenerationCheckpoint({ ...context, dialogue, voiceIds, artifacts });
  const missing = await restoreVoiceGenerationCheckpoint({
    checkpoint, ...context, dialogue, voiceIds, storage: storage(new Map())
  });
  assert.deepEqual(missing, [null, null]);
  const empty = await restoreVoiceGenerationCheckpoint({
    checkpoint, ...context, dialogue, voiceIds,
    storage: storage(new Map([["a".repeat(64), validRecord({ blob: new Blob([], { type: "audio/wav" }) })]]))
  });
  assert.deepEqual(empty, [null, null]);
});

test("rejects stored artifacts with mismatched hash, MIME, byte size or duration", async () => {
  const checkpoint = createVoiceGenerationCheckpoint({ ...context, dialogue, voiceIds, artifacts });
  const invalidRecords = [
    validRecord({ audioHash: "b".repeat(64) }),
    validRecord({ mimeType: "text/plain" }),
    validRecord({ byteSize: 999 }),
    validRecord({ durationMs: 800 })
  ];
  for (const record of invalidRecords) {
    const restored = await restoreVoiceGenerationCheckpoint({
      checkpoint, ...context, dialogue, voiceIds,
      storage: storage(new Map([["a".repeat(64), record]]))
    });
    assert.deepEqual(restored, [null, null]);
  }
});

test("rejects malformed checkpoint construction", () => {
  assert.throws(() => createVoiceGenerationCheckpoint({ ...context, dialogue, voiceIds: ["one"], artifacts }), /voice ID slot/);
  assert.throws(() => createVoiceGenerationCheckpoint({
    ...context, dialogue: [dialogue[0]], voiceIds: ["one"],
    artifacts: [{ audioHash: "bad", durationMs: 1 }]
  }), /SHA-256/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  UKRAINIAN_PIPER_MULTISPEAKER_MODEL,
  listPiperSpeakers,
  resolvePiperSpeakerId
} from "../src/piper-multispeaker-catalog.js";

const modelConfig = {
  num_speakers: 3,
  speaker_id_map: { lada: 0, mykyta: 1, tetiana: 2 }
};

test("describes the verified Ukrainian Piper multi-speaker ONNX model", () => {
  assert.equal(UKRAINIAN_PIPER_MULTISPEAKER_MODEL.locale, "uk");
  assert.equal(UKRAINIAN_PIPER_MULTISPEAKER_MODEL.modelBytes, 76_735_663);
  assert.equal(UKRAINIAN_PIPER_MULTISPEAKER_MODEL.sampleRate, 22_050);
  assert.deepEqual(
    UKRAINIAN_PIPER_MULTISPEAKER_MODEL.voices.map(voice => [voice.id, voice.speakerId]),
    [["lada", 0], ["mykyta", 1], ["tetiana", 2]]
  );
});

test("lists only valid speaker entries in stable speaker-ID order", () => {
  assert.deepEqual(listPiperSpeakers({
    speaker_id_map: { tetiana: 2, invalid: -1, mykyta: 1, lada: 0, broken: "3" }
  }), [
    { id: "lada", speakerId: 0 },
    { id: "mykyta", speakerId: 1 },
    { id: "tetiana", speakerId: 2 }
  ]);
});

test("resolves every Ukrainian character voice to its actual ONNX speaker ID", () => {
  assert.equal(resolvePiperSpeakerId(modelConfig, "lada"), 0);
  assert.equal(resolvePiperSpeakerId(modelConfig, "mykyta"), 1);
  assert.equal(resolvePiperSpeakerId(modelConfig, "tetiana"), 2);
  assert.equal(resolvePiperSpeakerId(modelConfig, " TETIANA "), 2);
});

test("rejects missing, unknown and invalid speaker IDs instead of silently using speaker zero", () => {
  assert.throws(() => resolvePiperSpeakerId(modelConfig, undefined), /voice ID is required/);
  assert.throws(() => resolvePiperSpeakerId(modelConfig, "unknown"), /not available/);
  assert.throws(() => resolvePiperSpeakerId({ speaker_id_map: { lada: "0" } }, "lada"), /invalid speaker ID/);
  assert.throws(() => resolvePiperSpeakerId({}, "lada"), /does not expose a speaker_id_map/);
});

test("returns no voices for malformed model configuration", () => {
  assert.deepEqual(listPiperSpeakers(null), []);
  assert.deepEqual(listPiperSpeakers({ speaker_id_map: [] }), []);
});

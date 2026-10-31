import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createBrowserLocalTtsEngine, encodePcm16Wav } from "../src/browser-local-tts-engine.js";
import { readWavPcmMetadata } from "../src/wav-pcm-metadata.js";

function makeStorage() {
  const records = new Map();
  return {
    records,
    async put(hash, blob, metadata) {
      const record = { audioHash: hash, blob, ...metadata };
      records.set(hash, record);
      return record;
    },
    async get(hash) { return records.get(hash) || null; }
  };
}
const environment = {
  isSecureContext: true,
  WebAssembly: { instantiate() {} },
  navigator: { hardwareConcurrency: 4 }
};
const validOutput = (sampleRate=16000) => ({
  audio: Float32Array.from([0, 0.25, -0.25, 0.5, -0.5, 0.1]),
  sampling_rate: sampleRate
});

test("encodes real float samples as valid mono PCM16 WAV", async () => {
  const blob = encodePcm16Wav(Float32Array.from([-1, -0.5, 0, 0.5, 1]), 16000);
  const meta = await readWavPcmMetadata(blob);
  assert.equal(meta.sampleRate, 16000);
  assert.equal(meta.channels, 1);
  assert.equal(meta.bitsPerSample, 16);
  assert.equal(meta.durationMs, 0.3125);
  const bytes = new DataView(await blob.arrayBuffer());
  assert.equal(bytes.getInt16(44, true), -32768);
  assert.equal(bytes.getInt16(52, true), 32767);
});

test("uses local Kokoro runtime and persists verified English speech", async () => {
  const storage = makeStorage();
  let modelOptions;
  const engine = createBrowserLocalTtsEngine({
    storage, cryptoRef: webcrypto, environment,
    kokoroFactory: async (id, options) => {
      modelOptions = { id, options };
      return { list_voices: () => ["af_heart", "af_bella"], generate: async () => validOutput(24000) };
    }
  });
  await engine.load({ locale: "en", backend: "wasm" });
  assert.deepEqual(engine.availableVoices, ["af_heart", "af_bella"]);
  assert.equal(modelOptions.id, "onnx-community/Kokoro-82M-v1.0-ONNX");
  assert.equal(modelOptions.options.device, "wasm");
  const result = await engine.synthesize({ text: "Hello from DRAVEX", voiceId: "af_bella" });
  assert.equal(result.sampleRate, 24000);
  assert.equal(result.locale, "en");
  assert.equal(result.localInference, true);
  assert.equal(result.remoteInference, false);
  assert.equal(storage.records.size, 1);
  assert.equal((await engine.get(result.audioHash)).blob.size, result.byteSize);
});

test("uses Transformers.js VITS path for Russian and persists actual sample rate", async () => {
  const storage = makeStorage();
  let loadedModel;
  const engine = createBrowserLocalTtsEngine({
    storage, cryptoRef: webcrypto, environment,
    transformersPipelineFactory: async (id, options) => {
      loadedModel = { id, options };
      return async text => {
        assert.equal(text, "Привет");
        return validOutput(16000);
      };
    }
  });
  await assert.rejects(engine.load({ locale: "ru" }), /Explicit opt-in/);
  await engine.load({ locale: "ru", allowNonCommercial: true });
  assert.equal(loadedModel.id, "Xenova/mms-tts-rus");
  const result = await engine.synthesize({ text: "Привет" });
  assert.equal(result.sampleRate, 16000);
  assert.equal(result.locale, "ru");
  assert.equal(storage.records.size, 1);
});

test("rejects unsupported locale, missing load, empty text and invalid provider audio", async () => {
  const engine = createBrowserLocalTtsEngine({
    storage: makeStorage(), cryptoRef: webcrypto, environment,
    transformersPipelineFactory: async () => async () => ({ audio: new Float32Array(0), sampling_rate: 16000 })
  });
  await assert.rejects(engine.load({ locale: "de" }), /No local TTS model/);
  await assert.rejects(engine.synthesize({ text: "Hi" }), /Load a local TTS model/);
  await engine.load({ locale: "ru", allowNonCommercial: true });
  await assert.rejects(engine.synthesize({ text: " " }), /must not be empty/);
  await assert.rejects(engine.synthesize({ text: "broken" }), /no Float32 audio/);
});

test("requires local storage and validates WAV encoder input", () => {
  assert.throws(() => createBrowserLocalTtsEngine(), /storage adapter/);
  assert.throws(() => encodePcm16Wav([], 16000), /Float32Array/);
  assert.throws(() => encodePcm16Wav(new Float32Array([1]), 1000), /sampleRate/);
});


test("falls back to the first installed Kokoro voice when the requested and default voices are unavailable", async () => {
  const storage = makeStorage();
  let generatedWithVoice;
  const engine = createBrowserLocalTtsEngine({
    storage, cryptoRef: webcrypto, environment,
    kokoroFactory: async () => ({
      list_voices: () => ["uk_custom_voice", "uk_second_voice"],
      generate: async (text, options) => {
        generatedWithVoice = options.voice;
        return validOutput(24000);
      }
    })
  });

  await engine.load({ locale: "en", backend: "wasm" });
  await engine.synthesize({ text: "A voice fallback test", voiceId: "missing_voice" });

  assert.equal(generatedWithVoice, "uk_custom_voice");
  assert.equal(storage.records.size, 1);
});


test("discovers voices from the public Kokoro voices catalog when list_voices only prints a table", async () => {
  const storage = makeStorage();
  let generatedWithVoice;
  const engine = createBrowserLocalTtsEngine({
    storage, cryptoRef: webcrypto, environment,
    kokoroFactory: async () => ({
      // This matches kokoro-js 1.2.1: console.table(VOICES), no return value.
      list_voices: () => undefined,
      voices: { af_heart: {}, af_bella: {}, am_adam: {} },
      generate: async (text, options) => {
        generatedWithVoice = options.voice;
        return validOutput(24000);
      }
    })
  });

  await engine.load({ locale: "en", backend: "wasm" });
  assert.deepEqual(engine.availableVoices, ["af_heart", "af_bella", "am_adam"]);
  await engine.synthesize({ text: "Catalog discovery test", voiceId: "am_adam" });

  assert.equal(generatedWithVoice, "am_adam");
  assert.equal(storage.records.size, 1);
});

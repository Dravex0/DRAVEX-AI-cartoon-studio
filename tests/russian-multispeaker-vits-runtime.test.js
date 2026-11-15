import test from "node:test";
import assert from "node:assert/strict";
import { createRussianVitsOnnxRuntime, createRussianVitsTokenizer, resolveRussianVitsSpeakerId } from "../src/russian-multispeaker-vits-runtime.js";

function makeHarness({ output = Float32Array.from([0.1, -0.2, 0.3, -0.4]) } = {}) {
  const calls = { fetch: [], sessionOptions: null, feeds: null, released: 0, tokenizerOptions: null };
  const session = {
    inputNames: ["input_ids", "attention_mask", "sid"],
    outputNames: ["waveform"],
    async run(feeds) { calls.feeds = feeds; return { waveform: { data: output } }; },
    release() { calls.released++; }
  };
  class Tensor {
    constructor(type, data, dims) { Object.assign(this, { type, data, dims }); }
  }
  const ort = {
    Tensor,
    InferenceSession: {
      async create(bytes, options) {
        calls.sessionOptions = options;
        assert.ok(bytes.byteLength > 0);
        return session;
      }
    }
  };
  const tokenizerFactory = async (modelId, options) => {
    calls.tokenizerOptions = { modelId, options };
    return async text => {
      calls.tokenizedText = text;
      return {
        input_ids: { data: BigInt64Array.from([1n, 12n, 2n]), dims: [1, 3] },
        attention_mask: { data: BigInt64Array.from([1n, 1n, 1n]), dims: [1, 3] }
      };
    };
  };
  const fetchImpl = async (url, options) => {
    calls.fetch.push({ url, options });
    return { ok: true, async arrayBuffer() { return new Uint8Array([1, 2, 3]).buffer; } };
  };
  return { calls, runtime: createRussianVitsOnnxRuntime({ ort, tokenizerFactory, fetchImpl }) };
}


test("encodes Russian text with the pinned character vocabulary and VITS blank tokens", async () => {
  const tokenizer = createRussianVitsTokenizer({
    " ": 0, "_": 1, ":": 2, "а": 3, "б": 4, "в": 5, "г": 6, "д": 7,
    "е": 8, "ё": 9, "ж": 10, "з": 11, "и": 12, "й": 13, "к": 14,
    "л": 15, "м": 16, "н": 17, "о": 18, "п": 19, "р": 20, "с": 21,
    "т": 22, "у": 23, "ф": 24, "х": 25, "ц": 26, "ч": 27, "ш": 28,
    "щ": 29, "ъ": 30, "ы": 31, "ь": 32, "э": 33, "ю": 34, "я": 35,
    ".": 36, "!": 37, "?": 38, ",": 39, "+": 40, "<unk>": 41, "<pad>": 42
  });
  const encoded = await tokenizer("ПРИВЕТ!");
  assert.deepEqual(Array.from(encoded.input_ids.data), [0n, 20n, 0n, 20n, 0n, 12n, 0n, 5n, 0n, 8n, 0n, 22n, 0n, 37n, 0n]);
  assert.deepEqual(Array.from(encoded.attention_mask.data), Array(15).fill(1n));
  assert.deepEqual(encoded.input_ids.dims, [1, 15]);
});

test("exposes exactly two explicit Russian speaker IDs and rejects unknown voices", () => {
  assert.equal(resolveRussianVitsSpeakerId("ru-female"), 0);
  assert.equal(resolveRussianVitsSpeakerId("ru-male"), 1);
  assert.throws(() => resolveRussianVitsSpeakerId("default"), /valid Russian character voice/);
});

test("loads pinned ONNX weights and tokenizer locally through injected adapters", async () => {
  const { calls, runtime } = makeHarness();
  const status = await runtime.load();
  assert.equal(status.loaded, true);
  assert.equal(status.localInference, true);
  assert.equal(calls.tokenizerOptions.modelId, "utrobinmv/tts_ru_free_hf_vits_low_multispeaker");
  assert.equal(calls.tokenizerOptions.options.revision, "0e9a395");
  assert.deepEqual(calls.sessionOptions.executionProviders, ["wasm"]);
  assert.match(calls.fetch[0].url, /resolve\/0e9a395\/model\.onnx$/);
  assert.deepEqual(runtime.availableVoices, ["ru-female", "ru-male"]);
});

test("sends the exact female or male speaker ID into the ONNX sid input", async () => {
  const { calls, runtime } = makeHarness();
  await runtime.load();
  const result = await runtime.synthesize({ text: "ПРИВЕТ!", voiceId: "ru-male" });
  assert.equal(calls.tokenizedText, "привет!");
  assert.equal(calls.feeds.input_ids.type, "int64");
  assert.deepEqual(Array.from(calls.feeds.input_ids.data), [1n, 12n, 2n]);
  assert.equal(calls.feeds.sid.type, "int64");
  assert.deepEqual(Array.from(calls.feeds.sid.data), [1n]);
  assert.deepEqual(result.audio, Float32Array.from([0.1, -0.2, 0.3, -0.4]));
  assert.equal(result.sampleRate, 16000);
  assert.equal(result.voiceId, "ru-male");
  assert.equal(result.speakerId, 1);
  assert.equal(result.durationMs, 0.25);
});

test("requires a voice ID and rejects invalid text or invalid model output", async () => {
  const { runtime } = makeHarness({ output: new Float32Array(0) });
  await runtime.load();
  await assert.rejects(runtime.synthesize({ text: "Привет" }), /valid Russian character voice/);
  await assert.rejects(runtime.synthesize({ text: "  ", voiceId: "ru-female" }), /must not be empty/);
  await assert.rejects(runtime.synthesize({ text: "Привет", voiceId: "ru-female" }), /no Float32 waveform/);
});

test("rejects model sessions that do not expose the speaker input", async () => {
  const ort = {
    Tensor: class {},
    InferenceSession: { async create() { return { inputNames: ["input_ids", "attention_mask"], outputNames: [], release() {} }; } }
  };
  const runtime = createRussianVitsOnnxRuntime({
    ort,
    tokenizerFactory: async () => async () => ({}),
    fetchImpl: async () => ({ ok: true, async arrayBuffer() { return new Uint8Array([1]).buffer; } })
  });
  await assert.rejects(runtime.load(), /missing required input: sid/);
});

test("releases ONNX memory on dispose", async () => {
  const { calls, runtime } = makeHarness();
  await runtime.load();
  runtime.dispose();
  assert.equal(calls.released, 1);
  assert.equal(runtime.status.loaded, false);
  assert.deepEqual(runtime.availableVoices, []);
});

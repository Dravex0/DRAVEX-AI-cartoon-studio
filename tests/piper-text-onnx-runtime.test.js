import test from "node:test";
import assert from "node:assert/strict";
import {
  createPiperTextOnnxRuntime,
  piperTextToIds,
  resolvePiperRuntimeSpeakerId
} from "../src/piper-text-onnx-runtime.js";

const config = {
  phoneme_type: "text",
  audio: { sample_rate: 22050 },
  num_speakers: 3,
  speaker_id_map: { lada: 0, mykyta: 1, tetiana: 2 },
  phoneme_id_map: {
    "_": [0], "^": [1], "$": [2], " ": [3],
    "а": [12], "б": [13], "в": [14], "і": [23], "т": [34], "\u0308": [35]
  }
};

function createHarness({ output = new Float32Array([0.1, -0.1, 0.2]) } = {}) {
  const calls = { fetch: [], sessionOptions: null, feeds: null, released: 0 };
  const session = {
    inputNames: ["input", "input_lengths", "scales", "sid"],
    async run(feeds) {
      calls.feeds = feeds;
      return { output: { data: output } };
    },
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
  const fetchImpl = async url => {
    calls.fetch.push(url);
    return url.endsWith(".json")
      ? { ok: true, async json() { return structuredClone(config); } }
      : { ok: true, async arrayBuffer() { return new Uint8Array([1, 2, 3]).buffer; } };
  };
  return { calls, runtime: createPiperTextOnnxRuntime({ ort, fetchImpl }) };
}

test("encodes Ukrainian text directly from the model character map", () => {
  assert.deepEqual(piperTextToIds("АБ", config), [1, 0, 12, 0, 13, 0, 2]);
  assert.throws(() => piperTextToIds("ї", config), /does not support text symbol/);
});

test("normalizes decomposed Unicode text without losing combining code points", () => {
  assert.deepEqual(piperTextToIds("і\u0308", config), [1, 0, 23, 0, 35, 0, 2]);
});

test("resolves and validates all three exact speaker IDs", () => {
  assert.equal(resolvePiperRuntimeSpeakerId(config, "lada"), 0);
  assert.equal(resolvePiperRuntimeSpeakerId(config, "mykyta"), 1);
  assert.equal(resolvePiperRuntimeSpeakerId(config, "tetiana"), 2);
  assert.throws(() => resolvePiperRuntimeSpeakerId(config, "unknown"), /not available/);
  assert.throws(() => resolvePiperRuntimeSpeakerId(config, ""), /voice ID is required/);
});

test("loads ONNX locally through WASM and sends the chosen speaker ID to sid", async () => {
  const { calls, runtime } = createHarness();
  const status = await runtime.load({ modelUrl: "/models/uk.onnx", configUrl: "/models/uk.onnx.json" });
  assert.equal(status.loaded, true);
  assert.deepEqual(calls.sessionOptions.executionProviders, ["wasm"]);
  const result = await runtime.synthesize({ text: "аб", voiceId: "mykyta" });
  assert.equal(result.speakerId, 1);
  assert.equal(result.sampleRate, 22050);
  assert.equal(result.durationMs, 3 / 22050 * 1000);
  assert.equal(calls.feeds.sid.type, "int64");
  assert.deepEqual(Array.from(calls.feeds.sid.data), [1n]);
  assert.equal(calls.feeds.input.type, "int64");
  assert.equal(calls.feeds.scales.type, "float32");
});

test("does not silently substitute speaker zero for an unknown character voice", async () => {
  const { runtime } = createHarness();
  await runtime.load({ modelUrl: "/models/uk.onnx", configUrl: "/models/uk.onnx.json" });
  await assert.rejects(runtime.synthesize({ text: "аб", voiceId: "unknown" }), /not available/);
});

test("rejects empty downloads and models that require eSpeak phonemization", async () => {
  const emptyFetch = async url => url.endsWith(".json")
    ? { ok: true, async json() { return structuredClone(config); } }
    : { ok: true, async arrayBuffer() { return new ArrayBuffer(0); } };
  const emptyRuntime = createPiperTextOnnxRuntime({
    ort: { Tensor: class {}, InferenceSession: { async create() { throw new Error("must not create session"); } } },
    fetchImpl: emptyFetch
  });
  await assert.rejects(emptyRuntime.load({ modelUrl: "/models/uk.onnx", configUrl: "/models/uk.onnx.json" }), /download was empty/);

  const espeakRuntime = createPiperTextOnnxRuntime({
    ort: { Tensor: class {}, InferenceSession: { async create() { throw new Error("must not create session"); } } },
    fetchImpl: async url => url.endsWith(".json")
      ? { ok: true, async json() { return { ...config, phoneme_type: "espeak" }; } }
      : { ok: true, async arrayBuffer() { return new Uint8Array([1]).buffer; } }
  });
  await assert.rejects(espeakRuntime.load({ modelUrl: "/models/ru.onnx", configUrl: "/models/ru.onnx.json" }), /only phoneme_type=text/);
});

test("releases the ONNX session on dispose", async () => {
  const { calls, runtime } = createHarness();
  await runtime.load({ modelUrl: "/models/uk.onnx", configUrl: "/models/uk.onnx.json" });
  runtime.dispose();
  assert.equal(calls.released, 1);
  assert.deepEqual(runtime.status, { loaded: false, localInference: true });
});

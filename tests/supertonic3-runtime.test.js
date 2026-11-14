import test from "node:test";
import assert from "node:assert/strict";
import { createSupertonic3Runtime } from "../src/supertonic3-runtime.js";
import { SUPERTONIC3_MODEL } from "../src/supertonic3-model.js";

function jsonResponse(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer };
}

function fakeOrt() {
  const created = [];
  const runs = [];
  class Tensor {
    constructor(type, data, dims) { Object.assign(this, { type, data, dims }); }
  }
  return {
    created,
    runs,
    Tensor,
    InferenceSession: {
      async create(bytes, options) {
        const index = created.length;
        const session = {
          released: false,
          async run(inputs) {
            if (index === 0) {
              runs.push(Number(inputs.style_dp.data[0]));
              return { duration: new Tensor("float32", new Float32Array([0.02]), [1]) };
            }
            if (index === 1) return { text_emb: new Tensor("float32", new Float32Array([0.25]), [1, 1, 1]) };
            if (index === 2) return { denoised_latent: new Tensor("float32", Float32Array.from(inputs.noisy_latent.data), inputs.noisy_latent.dims) };
            return { wav_tts: new Tensor("float32", new Float32Array([0, 0.2, -0.2, 0]), [1, 1, 4]) };
          },
          async release() { this.released = true; }
        };
        created.push({ byteLength: bytes.byteLength, options, session });
        return session;
      }
    }
  };
}

function modelFetch(url) {
  if (url.endsWith("tts.json")) {
    return jsonResponse({ ae: { sample_rate: 44100, base_chunk_size: 512 }, ttl: { chunk_compress_factor: 6, latent_dim: 24 } });
  }
  if (url.endsWith("unicode_indexer.json")) return jsonResponse(new Array(1200).fill(1));
  if (url.endsWith("F2.json") || url.endsWith("M1.json")) {
    const malePreset = url.endsWith("M1.json");
    return jsonResponse({
      style_ttl: { dims: [1, 1, 2], data: [malePreset ? [[0.7, 0.8]] : [[0.1, 0.2]]] },
      style_dp: { dims: [1, 1, 2], data: [malePreset ? [[0.7, 0.8]] : [[0.3, 0.4]]] }
    });
  }
  return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
}

test("Supertonic runtime refuses to download model assets before explicit license acceptance", async () => {
  let fetchCount = 0;
  const engine = createSupertonic3Runtime({
    runtimeFactory: async () => fakeOrt(),
    fetchImpl: async () => { fetchCount += 1; return jsonResponse({}); }
  });
  await assert.rejects(engine.load({ locale: "ru" }), /OpenRAIL-M/);
  assert.equal(fetchCount, 0);
  assert.equal(engine.status.loaded, false);
});

test("Supertonic runtime loads pinned ONNX sessions and marks the inference adapter ready", async () => {
  const ort = fakeOrt();
  const fetched = [];
  const engine = createSupertonic3Runtime({
    runtimeFactory: async () => ort,
    fetchImpl: async url => { fetched.push(url); return modelFetch(url); }
  });
  const progress = [];
  const status = await engine.load({
    locale: "ru-RU",
    acceptOpenRailTerms: true,
    backend: "wasm",
    onProgress: event => progress.push(event)
  });
  assert.equal(status.loaded, true);
  assert.equal(status.locale, "ru");
  assert.equal(status.inferenceAdapterAvailable, true);
  assert.equal(status.inferenceReady, false, "real model inference still needs a smoke test with downloaded weights");
  assert.equal(status.sessionNames.length, 4);
  assert.equal(ort.created.length, 4);
  assert.ok(ort.created.every(item => item.options.executionProviders[0] === "wasm"));
  assert.ok(fetched.every(url => url.includes(SUPERTONIC3_MODEL.revision)));
  assert.ok(progress.some(event => event.phase === "runtime-ready"));
  await engine.close();
  assert.equal(engine.status.loaded, false);
});

test("Supertonic voice style loader validates tensor shape and uses the selected preset", async () => {
  const ort = fakeOrt();
  const engine = createSupertonic3Runtime({ runtimeFactory: async () => ort, fetchImpl: modelFetch });
  await engine.load({ locale: "uk", acceptOpenRailTerms: true });
  const style = await engine.loadVoiceStyle("f2");
  assert.equal(style.voiceId, "F2");
  assert.deepEqual(style.styleTtl.dims, [1, 1, 2]);
  assert.ok(Math.abs(style.styleDp.data[0] - 0.3) < 1e-6);
  assert.ok(Math.abs(style.styleDp.data[1] - 0.4) < 1e-6);
  await engine.close();
});

test("Supertonic synthesis returns a WAV artifact and routes distinct character profiles", async () => {
  const ort = fakeOrt();
  const fetchedStyles = [];
  const engine = createSupertonic3Runtime({
    runtimeFactory: async () => ort,
    fetchImpl: async url => {
      if (url.includes("/voice_styles/")) fetchedStyles.push(url);
      return modelFetch(url);
    }
  });
  await engine.load({ locale: "ru", acceptOpenRailTerms: true });
  const progress = [];
  const result = await engine.synthesize({
    text: "Привет, мир!",
    voiceId: "F2",
    totalStep: 2,
    onProgress: event => progress.push(event)
  });
  assert.equal(result.mimeType, "audio/wav");
  assert.equal(result.voiceId, "F2");
  assert.equal(result.sampleRate, 44100);
  assert.ok(result.duration > 0);
  assert.equal(new TextDecoder().decode(new Uint8Array(result.arrayBuffer, 0, 4)), "RIFF");
  assert.equal(new TextDecoder().decode(new Uint8Array(result.arrayBuffer, 8, 4)), "WAVE");
  assert.ok(progress.some(event => event.phase === "audio-ready"));
  await engine.synthesize({ text: "Ещё реплика.", voiceId: "F2", totalStep: 1 });
  await engine.synthesize({ text: "Другой персонаж.", voiceId: "M1", totalStep: 1 });
  assert.equal(fetchedStyles.length, 2, "each voice style should be downloaded once and cached");
  assert.ok(ort.runs.some(value => Math.abs(value - 0.3) < 1e-6) && ort.runs.some(value => Math.abs(value - 0.7) < 1e-6), "different voice profiles must reach the duration model");
  await engine.close();
});

test("Supertonic runtime stops before creating more sessions when its signal is aborted", async () => {
  const ort = fakeOrt();
  const controller = new AbortController();
  let count = 0;
  const fetchImpl = async url => {
    count += 1;
    if (count === 3) controller.abort();
    if (url.endsWith("tts.json")) return jsonResponse({});
    if (url.endsWith("unicode_indexer.json")) return jsonResponse([0]);
    return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1]).buffer };
  };
  const engine = createSupertonic3Runtime({ runtimeFactory: async () => ort, fetchImpl });
  await assert.rejects(engine.load({
    locale: "ru",
    acceptOpenRailTerms: true,
    signal: controller.signal
  }), { name: "AbortError" });
  assert.equal(ort.created.length, 0);
});

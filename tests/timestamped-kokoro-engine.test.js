import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createTimestampedKokoroEngine } from "../src/timestamped-kokoro-engine.js";

function makeWav({ rate = 24000, frames = 24000 } = {}) {
  const dataSize = frames * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const put = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  put(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); put(8, "WAVE");
  put(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); put(36, "data"); view.setUint32(40, dataSize, true);
  new Uint8Array(buffer, 44).fill(12);
  return buffer;
}

function makeStorage() {
  const records = new Map();
  return {
    records,
    async put(audioHash, blob, metadata) {
      const record = { audioHash, blob, ...metadata };
      records.set(audioHash, record);
      return record;
    },
    async get(audioHash) { return records.get(audioHash) || null; }
  };
}

const environment = {
  Worker: function Worker() {},
  Blob,
  URL: { createObjectURL() {}, revokeObjectURL() {} }
};

test("loads timestamped Kokoro locally and persists WAV with model-timed visemes", async () => {
  const storage = makeStorage();
  let settings;
  let request;
  const engine = createTimestampedKokoroEngine({
    storage, cryptoRef: webcrypto, environment,
    headTtsFactory: async options => {
      settings = options;
      return {
        isConnected: false,
        async connect(_settings, onProgress) {
          onProgress?.({ status: "progress", loaded: 50, total: 100, progress: 0.5 });
          this.isConnected = true;
        },
        async synthesize(value) {
          request = value;
          return [{
            data: {
              audio: makeWav(),
              phonemes: ["h", "ə", "l", "oʊ"],
              visemes: ["PP", "aa", "I", "O"],
              vtimes: [0, 180, 420, 700],
              vdurations: [180, 240, 280, 300]
            }
          }];
        }
      };
    }
  });

  const progress = [];
  const status = await engine.load({ backend: "wasm", onProgress: value => progress.push(value) });
  assert.equal(settings.model, "onnx-community/Kokoro-82M-v1.0-ONNX-timestamped");
  assert.deepEqual(settings.endpoints, ["wasm"]);
  assert.equal(status.localInference, true);
  assert.equal(status.remoteInference, false);
  assert.equal(progress[0].progress, 0.5);

  const result = await engine.synthesize({ text: "Hello from DRAVEX", voiceId: "af_heart" });
  assert.equal(request.input, "Hello from DRAVEX");
  assert.equal(request.language, "en-us");
  assert.equal(result.durationMs, 1000);
  assert.deepEqual(result.visemeEvents.map(event => event.shape), ["closed", "open", "wide", "round"]);
  assert.equal(storage.records.size, 1);
  assert.equal((await engine.get(result.audioHash)).blob.type, "audio/wav");
});

test("rejects invalid voice output before saving any audio artifact", async () => {
  const storage = makeStorage();
  const engine = createTimestampedKokoroEngine({
    storage, cryptoRef: webcrypto, environment,
    headTtsFactory: async () => ({
      isConnected: false,
      async connect() { this.isConnected = true; },
      async synthesize() {
        return [{ data: {
          audio: makeWav(),
          visemes: ["UNKNOWN"],
          vtimes: [0],
          vdurations: [100]
        } }];
      }
    })
  });
  await engine.load();
  await assert.rejects(engine.synthesize({ text: "Hello" }), /Invalid timestamped Kokoro viseme/);
  assert.equal(storage.records.size, 0);
});

test("requires an explicit local load and enforces bounded dialogue input", async () => {
  const engine = createTimestampedKokoroEngine({
    storage: makeStorage(), cryptoRef: webcrypto, environment,
    headTtsFactory: async () => ({ isConnected: true })
  });
  await assert.rejects(engine.synthesize({ text: "Hello" }), /Load the timestamped English voice model/);
  await assert.rejects(engine.load({ backend: "remote" }), /backend must be wasm or webgpu/);
  assert.throws(() => createTimestampedKokoroEngine({ storage: {} }), /storage adapter/);
});

test("cancelling while the worker connects terminates it and closes its audio context", async () => {
  let finishConnect;
  let terminated = 0;
  let closed = 0;
  const fake = {
    isConnected: false,
    ww: { terminate() { terminated += 1; } },
    settings: { audioCtx: { state: "running", async close() { closed += 1; this.state = "closed"; } } },
    connect() {
      return new Promise(resolve => {
        finishConnect = () => { this.isConnected = true; resolve(); };
      });
    }
  };
  const engine = createTimestampedKokoroEngine({
    storage: makeStorage(), cryptoRef: webcrypto, environment,
    headTtsFactory: async () => fake
  });
  const controller = new AbortController();
  const pending = engine.load({ signal: controller.signal });
  while (!finishConnect) await Promise.resolve();
  controller.abort();
  finishConnect();
  await assert.rejects(pending, error => error?.name === "AbortError");
  assert.equal(terminated, 1);
  assert.equal(closed, 1);
  assert.equal(fake.ww, null);
  assert.equal(fake.isConnected, false);
  assert.equal(engine.status.loaded, false);
});

test("cleans up a worker when connection reports an asynchronous error", async () => {
  let terminated = 0;
  let closed = 0;
  const fake = {
    isConnected: true,
    ww: { terminate() { terminated += 1; } },
    settings: { audioCtx: { state: "running", async close() { closed += 1; } } },
    async connect(_settings, _progress, onError) {
      onError(new Error("worker initialization failed"));
    }
  };
  const engine = createTimestampedKokoroEngine({
    storage: makeStorage(), cryptoRef: webcrypto, environment,
    headTtsFactory: async () => fake
  });
  await assert.rejects(engine.load(), /worker initialization failed/);
  assert.equal(terminated, 1);
  assert.equal(closed, 1);
  assert.equal(engine.status.loaded, false);
});

test("rejects a conflicting backend while a different backend is loading", async () => {
  let finishConnect;
  const fake = {
    isConnected: false,
    async connect() {
      await new Promise(resolve => { finishConnect = resolve; });
      this.isConnected = true;
    }
  };
  const engine = createTimestampedKokoroEngine({
    storage: makeStorage(), cryptoRef: webcrypto, environment,
    headTtsFactory: async () => fake
  });
  const pending = engine.load({ backend: "wasm" });
  while (!finishConnect) await Promise.resolve();
  await assert.rejects(engine.load({ backend: "webgpu" }), /different timestamped Kokoro backend is already loading/);
  finishConnect();
  assert.equal((await pending).backend, "wasm");
});

test("dispose cancels an in-flight worker connection and releases its resources", async () => {
  let finishConnect;
  let terminated = 0;
  let closed = 0;
  const audioContext = {
    state: "running",
    async close() { closed += 1; this.state = "closed"; }
  };
  const fake = {
    isConnected: false,
    ww: { terminate() { terminated += 1; } },
    settings: { audioCtx: audioContext },
    connect() {
      return new Promise(resolve => {
        finishConnect = () => { this.isConnected = true; resolve(); };
      });
    }
  };
  const engine = createTimestampedKokoroEngine({
    storage: makeStorage(), cryptoRef: webcrypto, environment,
    headTtsFactory: async () => fake
  });
  const pending = engine.load();
  while (!finishConnect) await Promise.resolve();

  engine.dispose();
  assert.equal(terminated, 1);
  assert.equal(closed, 1);
  assert.equal(fake.ww, null);
  assert.equal(fake.isConnected, false);

  finishConnect();
  await assert.rejects(pending, error => error?.name === "AbortError");
  assert.equal(engine.status.loaded, false);
  assert.equal(engine.status.backend, null);
});

test("dispose promptly rejects a pending worker factory and cleans up its late result", async () => {
  let finishFactory;
  let connectCalls = 0;
  let terminated = 0;
  let closed = 0;
  const fake = {
    isConnected: false,
    ww: { terminate() { terminated += 1; } },
    settings: { audioCtx: { state: "running", async close() { closed += 1; this.state = "closed"; } } },
    async connect() { connectCalls += 1; this.isConnected = true; }
  };
  const engine = createTimestampedKokoroEngine({
    storage: makeStorage(), cryptoRef: webcrypto, environment,
    headTtsFactory: () => new Promise(resolve => { finishFactory = resolve; })
  });
  const pending = engine.load();
  while (!finishFactory) await Promise.resolve();

  engine.dispose();
  await assert.rejects(pending, error => error?.name === "AbortError");
  assert.equal(engine.status.loaded, false);

  finishFactory(fake);
  await Promise.resolve();
  assert.equal(connectCalls, 0);
  assert.equal(terminated, 1);
  assert.equal(closed, 1);
  assert.equal(fake.ww, null);
});

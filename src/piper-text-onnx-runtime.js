const DEFAULT_SCALES = Object.freeze({ noiseScale: 0.667, lengthScale: 1, noiseW: 0.8 });
const REQUIRED_INPUTS = ["input", "input_lengths", "scales"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function resolveCharacterIds(text, config) {
  const map = config?.phoneme_id_map;
  assert(map && typeof map === "object" && !Array.isArray(map),
    "Piper model config is missing phoneme_id_map.");
  const normalizedText = String(text ?? "").trim().toLowerCase().normalize("NFD");
  const symbols = Array.from(normalizedText);
  assert(symbols.length > 0, "Dialogue text must not be empty.");

  const ids = [];
  const pushSymbol = symbol => {
    const values = map[symbol];
    assert(Array.isArray(values) && values.length > 0 && values.every(Number.isInteger),
      `Piper model does not support text symbol: ${JSON.stringify(symbol)}`);
    ids.push(...values);
  };
  const bos = map["^"];
  const pad = map["_"];
  const eos = map["$"];
  assert(Array.isArray(bos) && Array.isArray(pad) && Array.isArray(eos),
    "Piper text model config must define BOS (^), padding (_) and EOS ($).");

  pushSymbol("^");
  pushSymbol("_");
  for (const symbol of symbols) {
    pushSymbol(symbol);
    pushSymbol("_");
  }
  pushSymbol("$");
  return ids;
}

function resolveSpeakerId(config, voiceId) {
  const count = Number(config?.num_speakers ?? 1);
  if (!Number.isInteger(count) || count < 1) throw new Error("Piper model has an invalid num_speakers value.");
  if (count === 1) {
    if (voiceId && config?.speaker_id_map && Object.keys(config.speaker_id_map).length) {
      throw new Error("A speaker voice was requested from a single-speaker Piper model.");
    }
    return null;
  }
  const requested = typeof voiceId === "string" ? voiceId.trim().toLowerCase() : "";
  if (!requested) throw new Error("A character voice ID is required for multi-speaker Piper synthesis.");
  const map = config?.speaker_id_map;
  if (!map || !Object.prototype.hasOwnProperty.call(map, requested)) {
    throw new Error(`Piper voice "${requested}" is not available in the loaded model.`);
  }
  const speakerId = map[requested];
  if (!Number.isInteger(speakerId) || speakerId < 0 || speakerId >= count) {
    throw new Error(`Piper voice "${requested}" has an invalid speaker ID.`);
  }
  return speakerId;
}

/**
 * Minimal browser ONNX adapter for Piper models with phoneme_type="text".
 * Dependencies are injected so the adapter can be tested without downloading
 * ONNX Runtime or model weights. No remote inference is performed.
 */
export function createPiperTextOnnxRuntime({ ort, fetchImpl = globalThis.fetch } = {}) {
  assert(ort?.InferenceSession?.create && typeof ort.Tensor === "function",
    "A compatible ONNX Runtime Web instance is required.");
  assert(typeof fetchImpl === "function", "A fetch implementation is required.");
  let loaded = null;

  return Object.freeze({
    get status() {
      return loaded ? {
        loaded: true,
        sampleRate: loaded.sampleRate,
        modelId: loaded.config?.language?.code ?? null,
        localInference: true
      } : { loaded: false, localInference: true };
    },

    async load({ modelUrl, configUrl, signal } = {}) {
      assert(typeof modelUrl === "string" && modelUrl, "Piper ONNX model URL is required.");
      assert(typeof configUrl === "string" && configUrl, "Piper model config URL is required.");
      const [modelResponse, configResponse] = await Promise.all([
        fetchImpl(modelUrl, { signal }),
        fetchImpl(configUrl, { signal })
      ]);
      if (!modelResponse.ok || !configResponse.ok) {
        throw new Error("Failed to load the Piper model or its configuration.");
      }
      const [modelBytes, config] = await Promise.all([
        modelResponse.arrayBuffer(),
        configResponse.json()
      ]);
      assert(modelBytes.byteLength > 0, "Piper ONNX model download was empty.");
      assert(config?.phoneme_type === "text",
        "This Piper adapter currently supports only phoneme_type=text models.");
      assert(Number.isInteger(config?.audio?.sample_rate) && config.audio.sample_rate > 0,
        "Piper model config has no valid audio sample rate.");
      const session = await ort.InferenceSession.create(modelBytes, {
        executionProviders: ["wasm"]
      });
      const inputNames = new Set(session.inputNames ?? []);
      for (const name of REQUIRED_INPUTS) {
        assert(inputNames.has(name), `Piper ONNX graph is missing required input: ${name}`);
      }
      if (Number(config.num_speakers ?? 1) > 1) {
        assert(inputNames.has("sid"), "Multi-speaker Piper graph is missing the sid input.");
      }
      loaded?.session?.release?.();
      loaded = { session, config, sampleRate: config.audio.sample_rate, inputNames };
      return this.status;
    },

    async synthesize({ text, voiceId, signal, scales = DEFAULT_SCALES } = {}) {
      assert(loaded, "Load a Piper ONNX model before generating speech.");
      if (signal?.aborted) {
        const error = new Error("Piper speech generation was cancelled.");
        error.name = "AbortError";
        throw error;
      }
      const ids = resolveCharacterIds(text, loaded.config);
      const speakerId = resolveSpeakerId(loaded.config, voiceId);
      const values = [scales.noiseScale, scales.lengthScale, scales.noiseW];
      assert(values.every(value => Number.isFinite(value) && value > 0 && value <= 5),
        "Piper inference scales must be finite numbers in the range (0, 5].");

      const feeds = {
        input: new ort.Tensor("int64", BigInt64Array.from(ids, value => BigInt(value)), [1, ids.length]),
        input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]),
        scales: new ort.Tensor("float32", Float32Array.from(values), [3])
      };
      if (speakerId !== null) {
        feeds.sid = new ort.Tensor("int64", BigInt64Array.from([BigInt(speakerId)]), [1]);
      }
      const result = await loaded.session.run(feeds);
      if (signal?.aborted) {
        const error = new Error("Piper speech generation was cancelled.");
        error.name = "AbortError";
        throw error;
      }
      const samples = result?.output?.data;
      assert(samples instanceof Float32Array && samples.length > 0,
        "Piper ONNX returned no audio samples.");
      return {
        audio: samples,
        sampleRate: loaded.sampleRate,
        speakerId,
        durationMs: samples.length / loaded.sampleRate * 1000
      };
    },

    dispose() {
      loaded?.session?.release?.();
      loaded = null;
    }
  });
}

export { resolveCharacterIds as piperTextToIds, resolveSpeakerId as resolvePiperRuntimeSpeakerId };

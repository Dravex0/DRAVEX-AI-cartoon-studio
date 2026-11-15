export const RUSSIAN_VITS_MODEL = Object.freeze({
  id: "utrobinmv-russian-vits-multispeaker",
  modelId: "utrobinmv/tts_ru_free_hf_vits_low_multispeaker",
  revision: "0e9a395",
  modelUrl: "https://huggingface.co/utrobinmv/tts_ru_free_hf_vits_low_multispeaker/resolve/0e9a395/model.onnx",
  locale: "ru",
  sampleRate: 16000,
  modelBytes: 50_800_000,
  license: "Apache-2.0",
  voices: Object.freeze([
    Object.freeze({ id: "ru-female", speakerId: 0, label: "Женский" }),
    Object.freeze({ id: "ru-male", speakerId: 1, label: "Мужской" })
  ])
});

const MAX_TEXT_LENGTH = 10_000;

export const RUSSIAN_VITS_VOCAB_URL = "https://huggingface.co/utrobinmv/tts_ru_free_hf_vits_low_multispeaker/resolve/0e9a395/vocab.json";

/** Build the character-level tokenizer used by this VITS checkpoint.
 * The repository ships vocab.json (not tokenizer.json); add_blank=true
 * inserts token 0 at both ends and between every character, matching HF VitsTokenizer.
 */
export function createRussianVitsTokenizer(vocab) {
  if (!vocab || typeof vocab !== "object" || Array.isArray(vocab)) {
    throw new TypeError("Russian VITS vocab.json must contain a character-to-ID object.");
  }
  const entries = Object.entries(vocab);
  if (!entries.length || entries.some(([token, id]) => !token || !Number.isInteger(id) || id < 0)) {
    throw new TypeError("Russian VITS vocabulary contains invalid token IDs.");
  }
  const ids = new Map(entries);
  const unknownId = ids.get("<unk>");
  if (!Number.isInteger(unknownId)) throw new Error("Russian VITS vocabulary is missing <unk>.");
  if (ids.get("<pad>") !== 42 || ids.get(" ") !== 0) {
    throw new Error("Russian VITS vocabulary does not match the pinned model format.");
  }
  return async text => {
    const normalized = normalizeText(text);
    const characters = Array.from(normalized);
    const tokenIds = [0];
    for (const character of characters) {
      tokenIds.push(ids.get(character) ?? unknownId, 0);
    }
    return {
      input_ids: { data: BigInt64Array.from(tokenIds, value => BigInt(value)), dims: [1, tokenIds.length] },
      attention_mask: { data: BigInt64Array.from(tokenIds, () => 1n), dims: [1, tokenIds.length] }
    };
  };
}

export async function loadRussianVitsTokenizer({ fetchImpl = globalThis.fetch, signal } = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetch is required to load the Russian VITS vocabulary.");
  const response = await fetchImpl(RUSSIAN_VITS_VOCAB_URL, { signal });
  if (!response?.ok) throw new Error("Russian VITS vocabulary download failed (HTTP " + (response?.status ?? "unknown") + ").");
  const vocab = await response.json();
  assertNotAborted(signal);
  return createRussianVitsTokenizer(vocab);
}

function assertNotAborted(signal) {
  if (signal?.aborted) {
    const error = new Error("Russian speech generation was cancelled.");
    error.name = "AbortError";
    throw error;
  }
}

function normalizeText(value) {
  const text = String(value ?? "").trim().normalize("NFC").toLocaleLowerCase("ru-RU");
  if (!text) throw new TypeError("Russian dialogue text must not be empty.");
  if (text.length > MAX_TEXT_LENGTH) throw new RangeError("Russian dialogue text exceeds 10000 characters.");
  return text;
}

function toInt64TensorData(data) {
  return BigInt64Array.from(Array.from(data ?? [], value => BigInt(Number(value))));
}

function normalizeWaveform(tensor) {
  const data = tensor?.data;
  if (!(data instanceof Float32Array) || data.length === 0) {
    throw new Error("Russian VITS ONNX returned no Float32 waveform samples.");
  }
  for (let i = 0; i < data.length; i++) {
    if (!Number.isFinite(data[i])) throw new Error("Russian VITS ONNX returned non-finite audio samples.");
  }
  return data;
}

export function resolveRussianVitsSpeakerId(voiceId) {
  const voice = RUSSIAN_VITS_MODEL.voices.find(item => item.id === String(voiceId ?? "").trim());
  if (!voice) throw new Error("A valid Russian character voice is required (ru-female or ru-male).");
  return voice.speakerId;
}

/**
 * Direct ONNX Runtime Web adapter for the Apache-2.0 two-speaker Russian VITS.
 * The tokenizer and ONNX session are injected so tests never need model downloads.
 */
export function createRussianVitsOnnxRuntime({
  ort,
  tokenizerFactory,
  fetchImpl = globalThis.fetch,
  model = RUSSIAN_VITS_MODEL
} = {}) {
  if (!ort?.Tensor || !ort?.InferenceSession?.create) throw new TypeError("ONNX Runtime Web is required.");
  if (typeof tokenizerFactory !== "function") throw new TypeError("A VITS tokenizer factory is required.");
  if (typeof fetchImpl !== "function") throw new TypeError("fetch is required.");

  let tokenizer = null;
  let session = null;
  let loading = null;

  return Object.freeze({
    get availableVoices() { return session && tokenizer ? model.voices.map(voice => voice.id) : []; },
    get status() { return { loaded: Boolean(session && tokenizer), localInference: true, modelId: model.modelId }; },

    async load({ signal, onProgress } = {}) {
      assertNotAborted(signal);
      if (session && tokenizer) return this.status;
      if (loading) return loading;
      loading = (async () => {
        const [nextTokenizer, response] = await Promise.all([
          tokenizerFactory(model.modelId, { revision: model.revision, progress_callback: onProgress, signal }),
          fetchImpl(model.modelUrl, { signal })
        ]);
        assertNotAborted(signal);
        if (!response?.ok) throw new Error("Russian VITS model download failed (HTTP " + (response?.status ?? "unknown") + ").");
        const bytes = await response.arrayBuffer();
        if (!(bytes instanceof ArrayBuffer) || bytes.byteLength === 0) throw new Error("Russian VITS model download was empty.");
        const nextSession = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] });
        const names = new Set(nextSession.inputNames ?? []);
        for (const required of ["input_ids", "attention_mask", "sid"]) {
          if (!names.has(required)) {
            nextSession.release?.();
            throw new Error("Russian VITS ONNX model is missing required input: " + required);
          }
        }
        assertNotAborted(signal);
        tokenizer = nextTokenizer;
        session = nextSession;
        return this.status;
      })();
      try { return await loading; }
      finally { loading = null; }
    },

    async synthesize({ text, voiceId, signal } = {}) {
      assertNotAborted(signal);
      if (!session || !tokenizer) throw new Error("Load the Russian VITS model before synthesis.");
      const cleanText = normalizeText(text);
      const speakerId = resolveRussianVitsSpeakerId(voiceId);
      const encoded = await tokenizer(cleanText);
      assertNotAborted(signal);
      const ids = encoded?.input_ids;
      const mask = encoded?.attention_mask;
      if (!ids?.data?.length || !Array.isArray(ids.dims) || !mask?.data?.length || !Array.isArray(mask.dims)) {
        throw new Error("Russian VITS tokenizer returned invalid input_ids or attention_mask.");
      }
      const feeds = {
        input_ids: new ort.Tensor("int64", toInt64TensorData(ids.data), [...ids.dims]),
        attention_mask: new ort.Tensor("int64", toInt64TensorData(mask.data), [...mask.dims]),
        sid: new ort.Tensor("int64", BigInt64Array.of(BigInt(speakerId)), [1])
      };
      const outputs = await session.run(feeds);
      assertNotAborted(signal);
      const outputName = session.outputNames?.[0];
      const waveform = normalizeWaveform(outputName ? outputs?.[outputName] : Object.values(outputs ?? {})[0]);
      return {
        audio: waveform,
        sampleRate: model.sampleRate,
        speakerId,
        voiceId,
        durationMs: waveform.length / model.sampleRate * 1000
      };
    },

    dispose() {
      session?.release?.();
      session = null;
      tokenizer = null;
      loading = null;
    }
  });
}

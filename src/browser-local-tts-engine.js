import { getLocalTtsModel } from "./local-tts-model-registry.js";
import { createVerifiedVoiceArtifactStore } from "./verified-voice-artifact.js";
import { detectDeviceCapabilities } from "./device-capabilities.js";

const DEFAULT_KOKORO_VOICE = "af_heart";
const MAX_TEXT_LENGTH = 10_000;
const MAX_AUDIO_SECONDS = 600;

function assertNotAborted(signal) {
  if (signal?.aborted) {
    const error = new Error("Local speech generation was cancelled.");
    error.name = "AbortError";
    throw error;
  }
}

function getKokoroVoiceIds(instance) {
  if (!instance || typeof instance !== "object") return [];
  // kokoro-js 1.2.1 list_voices() prints a table and returns undefined;
  // its public voices getter contains the actual voice catalog.
  let listed;
  if (typeof instance.list_voices === "function") {
    try { listed = instance.list_voices(); } catch { listed = null; }
  }
  const candidates = Array.isArray(listed)
    ? listed
    : instance.voices && typeof instance.voices === "object"
      ? Object.keys(instance.voices)
      : [];
  return [...new Set(candidates.filter(value => typeof value === "string" && value.trim()).map(value => value.trim()))];
}

function normalizeAudio(output) {
  const audio = output?.audio;
  const sampleRate = Number(output?.sampling_rate ?? output?.sampleRate);
  if (!(audio instanceof Float32Array) || audio.length === 0) {
    throw new Error("The local TTS model returned no Float32 audio samples.");
  }
  if (!Number.isInteger(sampleRate) || sampleRate < 8_000 || sampleRate > 96_000) {
    throw new Error("The local TTS model returned an unsupported sample rate.");
  }
  if (audio.length > sampleRate * MAX_AUDIO_SECONDS) {
    throw new RangeError("Generated speech exceeds the 10-minute safety limit.");
  }
  for (let i = 0; i < audio.length; i++) {
    if (!Number.isFinite(audio[i])) throw new Error("Generated speech contains a non-finite audio sample.");
  }
  return { audio, sampleRate };
}

/** Encode real model samples as mono signed 16-bit PCM WAV. */
export function encodePcm16Wav(samples, sampleRate) {
  if (!(samples instanceof Float32Array) || samples.length === 0) {
    throw new TypeError("PCM encoding requires a non-empty Float32Array.");
  }
  if (!Number.isInteger(sampleRate) || sampleRate < 8_000 || sampleRate > 96_000) {
    throw new RangeError("sampleRate must be an integer between 8000 and 96000.");
  }
  if (samples.length > sampleRate * MAX_AUDIO_SECONDS) {
    throw new RangeError("Audio exceeds the 10-minute safety limit.");
  }
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeText = (offset, value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, value < 0 ? Math.round(value * 32768) : Math.round(value * 32767), true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

async function defaultTransformersPipelineFactory(modelId, options) {
  const { pipeline } = await import("@huggingface/transformers");
  return pipeline("text-to-speech", modelId, options);
}

async function defaultKokoroFactory(modelId, options) {
  const { KokoroTTS } = await import("kokoro-js");
  return KokoroTTS.from_pretrained(modelId, options);
}

/**
 * Browser-local TTS adapter.
 * Models are downloaded only after explicit load() invocation. Inference stays
 * on-device; output is encoded, measured, SHA-256 identified and stored locally.
 */
export function createBrowserLocalTtsEngine({
  storage,
  cryptoRef = globalThis.crypto,
  environment = globalThis,
  transformersPipelineFactory = defaultTransformersPipelineFactory,
  kokoroFactory = defaultKokoroFactory
} = {}) {
  if (!storage) throw new TypeError("A local voice storage adapter is required.");
  const artifacts = createVerifiedVoiceArtifactStore({ storage, cryptoRef });
  let loaded = null;
  let loading = null;

  return Object.freeze({
    get availableVoices() {
      if (!loaded || loaded.model.runtime !== "kokoro-js") return [];
      return getKokoroVoiceIds(loaded.instance);
    },

    get status() {
      return loaded ? {
        loaded: true,
        locale: loaded.model.locale,
        modelId: loaded.model.modelId,
        engine: loaded.engine,
        backend: loaded.backend,
        localInference: true
      } : { loaded: false, localInference: true };
    },

    async load({ locale, allowNonCommercial = false, backend = "wasm", onProgress, signal } = {}) {
      assertNotAborted(signal);
      const model = getLocalTtsModel(locale, { allowNonCommercial });
      if (!model.available) {
        throw new Error(model.reason === "non-commercial-license-requires-opt-in"
          ? "This model is restricted to non-commercial use. Explicit opt-in is required."
          : "No local TTS model is registered for this language.");
      }
      if (!["wasm", "webgpu"].includes(backend)) throw new TypeError("backend must be wasm or webgpu.");
      const key = [model.modelId, backend].join("|");
      if (loaded && loaded.key === key) return this.status;
      if (loading) {
        if (loading.key !== key) throw new Error("A different local TTS model is already loading.");
        return loading.promise;
      }

      const promise = (async () => {
        const capabilities = await detectDeviceCapabilities(environment);
        assertNotAborted(signal);
        if (backend === "webgpu" && (!capabilities.secureContext || !capabilities.adapterAvailable)) {
          throw new Error("WebGPU is unavailable in this secure browser context. Choose WASM.");
        }
        if (backend === "wasm" && !capabilities.wasmAvailable) {
          throw new Error("WebAssembly is unavailable in this browser.");
        }
        const progress = info => {
          if (typeof onProgress !== "function") return;
          try {
            onProgress({
              status: String(info?.status || "progress").slice(0, 40),
              file: String(info?.file || "").slice(-120),
              loaded: Number.isFinite(info?.loaded) ? info.loaded : null,
              total: Number.isFinite(info?.total) ? info.total : null,
              progress: Number.isFinite(info?.progress) ? Math.max(0, Math.min(1, info.progress)) : null
            });
          } catch { /* Progress UI must not break model loading. */ }
        };
        let modelInstance;
        let engine;
        if (model.runtime === "kokoro-js") {
          engine = "kokoro-js";
          modelInstance = await kokoroFactory(model.modelId, {
            dtype: "q8",
            device: backend,
            progress_callback: progress
          });
        } else {
          engine = "@huggingface/transformers";
          modelInstance = await transformersPipelineFactory(model.modelId, {
            dtype: "q8",
            device: backend,
            progress_callback: progress
          });
        }
        assertNotAborted(signal);
        if (model.runtime === "kokoro-js" && typeof modelInstance?.generate !== "function") {
          throw new Error("Kokoro did not provide a speech generation function.");
        }
        if (model.runtime !== "kokoro-js" && typeof modelInstance !== "function") {
          throw new Error("Transformers.js did not provide a text-to-speech pipeline.");
        }
        loaded = { key, model, engine, backend, instance: modelInstance };
        return this.status;
      })();
      loading = { key, promise };
      try {
        return await promise;
      } finally {
        loading = null;
      }
    },

    async synthesize({ text, voiceId = DEFAULT_KOKORO_VOICE, filename = "scene-voice.wav", signal } = {}) {
      assertNotAborted(signal);
      if (!loaded) throw new Error("Load a local TTS model before generating speech.");
      const cleanText = String(text ?? "").trim();
      if (!cleanText) throw new TypeError("Dialogue text must not be empty.");
      if (cleanText.length > MAX_TEXT_LENGTH) throw new RangeError("Dialogue text exceeds 10000 characters.");
      let output;
      if (loaded.model.runtime === "kokoro-js") {
        const availableVoices = getKokoroVoiceIds(loaded.instance);
        const selectedVoice = availableVoices.length
          ? (availableVoices.includes(voiceId)
            ? voiceId
            : availableVoices.includes(DEFAULT_KOKORO_VOICE)
              ? DEFAULT_KOKORO_VOICE
              : availableVoices[0])
          : voiceId;
        output = await loaded.instance.generate(cleanText, { voice: selectedVoice });
      } else {
        output = await loaded.instance(cleanText);
      }
      assertNotAborted(signal);
      const { audio, sampleRate } = normalizeAudio(output);
      const blob = encodePcm16Wav(audio, sampleRate);
      const expectedDurationMs = audio.length / sampleRate * 1000;
      const saved = await artifacts.save({
        blob,
        filename,
        engineUsed: loaded.engine + ":" + loaded.model.modelId,
        expectedDurationMs,
        expectedSampleRate: sampleRate
      });
      return {
        ...saved,
        blob,
        modelId: loaded.model.modelId,
        locale: loaded.model.locale,
        engine: loaded.engine,
        backend: loaded.backend,
        localInference: true,
        remoteInference: false
      };
    },

    async get(audioHash) {
      return artifacts.get(audioHash);
    }
  });
}

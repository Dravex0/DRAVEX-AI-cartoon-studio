import { createVerifiedVoiceArtifactStore } from "./verified-voice-artifact.js";
import { buildTimestampedKokoroVisemeEvents } from "./timestamped-kokoro-viseme-adapter.js";
import { readWavPcmMetadata } from "./wav-pcm-metadata.js";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX-timestamped";
const TRANSFORMERS_MODULE = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/dist/transformers.min.js";
const VOICE_URL = "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices";
const MAX_TEXT_LENGTH = 500;

async function defaultHeadTtsFactory(settings, onerror) {
  const { HeadTTS } = await import("../vendor/headtts/headtts.mjs");
  return new HeadTTS(settings, onerror);
}

function normalizeProgress(info) {
  return {
    status: String(info?.status || "progress").slice(0, 40),
    file: String(info?.file || "").slice(-120),
    loaded: Number.isFinite(info?.loaded) ? info.loaded : null,
    total: Number.isFinite(info?.total) ? info.total : null,
    progress: Number.isFinite(info?.progress) ? Math.max(0, Math.min(1, info.progress)) : null
  };
}

/**
 * Optional English-only timestamped Kokoro engine.
 * Inference runs in a local Web Worker; model/voice assets are fetched only
 * after explicit load() from the user. The worker returns model-derived
 * phoneme/viseme timestamps alongside PCM WAV audio.
 */
export function createTimestampedKokoroEngine({
  storage,
  cryptoRef = globalThis.crypto,
  headTtsFactory = defaultHeadTtsFactory,
  environment = globalThis
} = {}) {
  if (!storage) throw new TypeError("A local voice storage adapter is required.");
  const artifacts = createVerifiedVoiceArtifactStore({ storage, cryptoRef });
  let instance = null;
  let loading = null;
  let backend = null;

  return Object.freeze({
    get availableVoices() {
      return instance?.isConnected ? ["af_heart"] : [];
    },

    get status() {
      return {
        loaded: Boolean(instance?.isConnected),
        locale: "en",
        modelId: MODEL_ID,
        engine: "headtts-timestamped-kokoro",
        backend,
        localInference: true,
        remoteInference: false
      };
    },

    async load({ backend: requestedBackend = "wasm", onProgress, signal } = {}) {
      if (signal?.aborted) throw Object.assign(new Error("Model loading was cancelled."), { name: "AbortError" });
      if (!["wasm", "webgpu"].includes(requestedBackend)) throw new TypeError("backend must be wasm or webgpu.");
      if (instance?.isConnected && backend === requestedBackend) return this.status;
      if (loading) return loading;

      loading = (async () => {
        if (!environment?.Worker || !environment?.Blob || !environment?.URL?.createObjectURL) {
          throw new Error("Module Web Workers are unavailable in this browser.");
        }
        let reportedError = null;
        const onError = error => { reportedError = error instanceof Error ? error : new Error(String(error)); };
        const engine = await headTtsFactory({
          endpoints: [requestedBackend],
          model: MODEL_ID,
          transformersModule: TRANSFORMERS_MODULE,
          dtypeWebgpu: "q8",
          dtypeWasm: "q4",
          styleDim: 256,
          frameRate: 40,
          audioSampleRate: 24000,
          languages: ["en-us"],
          dictionaryURL: null,
          voiceURL: VOICE_URL,
          voices: ["af_heart"],
          splitSentences: false,
          splitLength: MAX_TEXT_LENGTH + 1,
          defaultVoice: "af_heart",
          defaultLanguage: "en-us",
          defaultAudioEncoding: "wav",
          deltaStart: -10,
          deltaEnd: 10
        }, onError);
        if (signal?.aborted) throw Object.assign(new Error("Model loading was cancelled."), { name: "AbortError" });
        await engine.connect(null, info => {
          try { onProgress?.(normalizeProgress(info)); } catch { /* Progress UI is non-critical. */ }
        }, onError);
        if (reportedError) throw reportedError;
        if (!engine.isConnected) throw new Error("Timestamped Kokoro could not connect to its local worker.");
        instance = engine;
        backend = requestedBackend;
        return this.status;
      })();

      try {
        return await loading;
      } finally {
        loading = null;
      }
    },

    async synthesize({ text, voiceId = "af_heart", signal } = {}) {
      if (signal?.aborted) throw Object.assign(new Error("Speech generation was cancelled."), { name: "AbortError" });
      if (!instance?.isConnected) throw new Error("Load the timestamped English voice model first.");
      const cleanText = String(text ?? "").trim();
      if (!cleanText) throw new TypeError("Dialogue text must not be empty.");
      if (cleanText.length > MAX_TEXT_LENGTH) throw new RangeError("Timestamped English dialogue is limited to 500 characters per cue.");
      const messages = await instance.synthesize({
        input: cleanText,
        voice: String(voiceId || "af_heart"),
        language: "en-us",
        audioEncoding: "wav"
      });
      if (signal?.aborted) throw Object.assign(new Error("Speech generation was cancelled."), { name: "AbortError" });
      if (!Array.isArray(messages) || messages.length !== 1) {
        throw new Error("Timestamped Kokoro returned an unexpected number of audio segments.");
      }
      const data = messages[0]?.data;
      const audio = data?.audio;
      if (!(audio instanceof ArrayBuffer) && !ArrayBuffer.isView(audio)) {
        throw new Error("Timestamped Kokoro returned no WAV audio bytes.");
      }
      const blob = new Blob([audio], { type: "audio/wav" });
      const measuredAudio = await readWavPcmMetadata(blob);
      const durationHint = Number(data?.durationMs);
      if (Number.isFinite(durationHint) && durationHint > 0
        && Math.abs(durationHint - measuredAudio.durationMs) > Math.max(50, measuredAudio.durationMs * 0.02)) {
        throw new Error("Timestamped Kokoro duration metadata does not match the WAV audio.");
      }
      if (measuredAudio.sampleRate !== 24000) {
        throw new Error("Timestamped Kokoro returned an unexpected WAV sample rate.");
      }
      const visemeEvents = buildTimestampedKokoroVisemeEvents({
        visemes: data.visemes,
        vtimes: data.vtimes,
        vdurations: data.vdurations,
        durationMs: measuredAudio.durationMs
      });
      const saved = await artifacts.save({
        blob,
        filename: "timestamped-kokoro-" + String(voiceId || "af_heart") + ".wav",
        engineUsed: "headtts-timestamped-kokoro",
        expectedDurationMs: measuredAudio.durationMs,
        expectedSampleRate: 24000
      });
      return {
        ...saved,
        locale: "en",
        voiceId: String(voiceId || "af_heart"),
        engine: "headtts-timestamped-kokoro",
        localInference: true,
        remoteInference: false,
        phonemes: Array.isArray(data.phonemes) ? data.phonemes.map(value => String(value).slice(0, 16)) : [],
        visemeEvents
      };
    },

    async get(audioHash) {
      return artifacts.get(audioHash);
    },

    dispose() {
      if (instance?.ww && typeof instance.ww.terminate === "function") {
        instance.ww.terminate();
        instance.ww = null;
      }
      if (instance?.settings?.audioCtx && instance.settings.audioCtx.state !== "closed") {
        instance.settings.audioCtx.close().catch(() => {});
      }
      if (instance) instance.isConnected = false;
      instance = null;
      backend = null;
    }
  });
}

import * as ort from "onnxruntime-web/wasm";
import { AutoTokenizer } from "@huggingface/transformers";
import { RUSSIAN_VITS_MODEL, createRussianVitsOnnxRuntime } from "./russian-multispeaker-vits-runtime.js";
import { encodePcm16Wav } from "./browser-local-tts-engine.js";
import { buildAudioMouthEnvelope } from "./audio-mouth-envelope.js";
import { buildVisemeTimeline } from "./viseme-timeline.js";

const TEST_DIALOGUE = "Привет! Сегодня мы создаём мультфильм.";
const EXPECTED_VOICES = ["ru-female", "ru-male"];

function measure(samples) {
  let peak = 0;
  let sumSquares = 0;
  for (const sample of samples) {
    if (!Number.isFinite(sample)) throw new Error("Russian VITS returned a non-finite audio sample.");
    peak = Math.max(peak, Math.abs(sample));
    sumSquares += sample * sample;
  }
  const rms = Math.sqrt(sumSquares / samples.length);
  if (peak < 0.001 || rms < 0.0001) throw new Error("Russian VITS returned silent or near-silent audio.");
  return { peak, rms };
}

function triggerWavDownload(blob, voiceId) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ru-vits-${voiceId}.wav`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Opt-in real-weight test. This downloads the pinned 50.8 MB ONNX model. */
export async function runRussianVitsRealInferenceSmoke({ downloadWavs = false, onProgress } = {}) {
  if (ort.env?.wasm) {
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmPaths = new URL("/vendor/onnxruntime/", globalThis.location.href).href;
  }
  const runtime = createRussianVitsOnnxRuntime({
    ort,
    model: RUSSIAN_VITS_MODEL,
    tokenizerFactory: (modelId, options) => AutoTokenizer.from_pretrained(modelId, options)
  });
  try {
    await runtime.load({ onProgress });
    const availableVoices = runtime.availableVoices;
    if (EXPECTED_VOICES.some(id => !availableVoices.includes(id)) || availableVoices.length !== 2) {
      throw new Error("The Russian VITS runtime did not expose exactly its two configured voices.");
    }
    const results = [];
    for (const voiceId of EXPECTED_VOICES) {
      onProgress?.({ phase: "inference", voiceId });
      const output = await runtime.synthesize({ text: TEST_DIALOGUE, voiceId });
      const metrics = measure(output.audio);
      const durationMs = output.audio.length / output.sampleRate * 1000;
      if (durationMs < 250 || durationMs > 15_000) {
        throw new Error("Russian VITS generated an implausible speech duration for " + voiceId + ".");
      }
      const envelope = buildAudioMouthEnvelope({
        channels: [output.audio], sampleRate: output.sampleRate, fps: 24
      });
      const activeMouthFrames = envelope.frames.filter(value => value > 0.025).length;
      const visemes = buildVisemeTimeline({
        text: TEST_DIALOGUE, durationMs: envelope.durationMs, language: "ru", fps: 24
      });
      if (!activeMouthFrames || visemes.frames.length !== envelope.frameCount) {
        throw new Error("Russian VITS audio did not produce usable mouth timing for " + voiceId + ".");
      }
      const wav = encodePcm16Wav(output.audio, output.sampleRate);
      const digest = await globalThis.crypto.subtle.digest("SHA-256", await wav.arrayBuffer());
      const sha256 = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
      if (downloadWavs) triggerWavDownload(wav, voiceId);
      results.push({
        voiceId, speakerId: output.speakerId, sampleRate: output.sampleRate,
        sampleCount: output.audio.length, durationMs, peak: metrics.peak, rms: metrics.rms,
        mouthEnvelopeFrames: envelope.frameCount, mouthActiveFrames: activeMouthFrames,
        visemeSource: visemes.source, wavBytes: wav.size, sha256
      });
    }
    if (new Set(results.map(item => item.speakerId)).size !== 2) {
      throw new Error("Russian VITS voices did not resolve to distinct speaker IDs.");
    }
    if (new Set(results.map(item => item.sha256)).size !== 2) {
      throw new Error("Russian VITS speaker IDs produced identical WAV files.");
    }
    return {
      modelId: RUSSIAN_VITS_MODEL.modelId,
      revision: RUSSIAN_VITS_MODEL.revision,
      modelBytes: RUSSIAN_VITS_MODEL.modelBytes,
      dialogue: TEST_DIALOGUE,
      availableVoices,
      results
    };
  } finally {
    runtime.dispose();
  }
}

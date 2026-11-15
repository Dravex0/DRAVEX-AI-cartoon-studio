import * as ort from "onnxruntime-web/wasm";
import { getLocalTtsModel } from "./local-tts-model-registry.js";
import { createPiperTextOnnxRuntime } from "./piper-text-onnx-runtime.js";
import { encodePcm16Wav } from "./browser-local-tts-engine.js";

const TEST_DIALOGUE = "Привіт! Сьогодні ми створюємо мультфільм.";
const EXPECTED_VOICES = ["lada", "mykyta", "tetiana"];

function measure(samples) {
  let peak = 0;
  let sumSquares = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (!Number.isFinite(sample)) {
      throw new Error("Real Piper inference returned a non-finite audio sample.");
    }
    const absolute = Math.abs(sample);
    if (absolute > peak) peak = absolute;
    sumSquares += sample * sample;
  }
  const rms = Math.sqrt(sumSquares / samples.length);
  if (peak < 0.001 || rms < 0.0001) {
    throw new Error("Real Piper inference returned silent or near-silent audio.");
  }
  return { peak, rms };
}

/**
 * Explicit, opt-in real-weight smoke test. Downloads the actual Ukrainian
 * Piper ONNX weights and runs each configured speaker locally in the browser.
 * This is intentionally not called by the application or ordinary CI tests.
 */
export async function runPiperRealInferenceSmoke({ onProgress } = {}) {
  const model = getLocalTtsModel("uk");
  if (!model.available || model.runtime !== "piper-onnx") {
    throw new Error("The Ukrainian Piper model is not registered.");
  }

  if (ort.env?.wasm) {
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmPaths = new URL("/vendor/onnxruntime/", globalThis.location.href).href;
  }

  const runtime = createPiperTextOnnxRuntime({ ort });
  try {
    await runtime.load({
      modelUrl: model.modelUrl,
      configUrl: model.configUrl
    });

    const availableVoices = runtime.availableVoices;
    if (EXPECTED_VOICES.some(voice => !availableVoices.includes(voice))
      || availableVoices.length !== EXPECTED_VOICES.length) {
      throw new Error("The downloaded Piper config does not expose the three expected speaker IDs.");
    }

    const results = [];
    for (const voiceId of EXPECTED_VOICES) {
      onProgress?.({ phase: "inference", voiceId });
      const output = await runtime.synthesize({
        text: TEST_DIALOGUE,
        voiceId,
        scales: { noiseScale: 0.1, lengthScale: 1, noiseW: 0.8 }
      });
      const metrics = measure(output.audio);
      const durationMs = output.audio.length / output.sampleRate * 1000;
      if (durationMs < 250 || durationMs > 15_000) {
        throw new Error("Piper generated an implausible speech duration for " + voiceId + ".");
      }
      const wav = encodePcm16Wav(output.audio, output.sampleRate);
      const wavBytes = new Uint8Array(await wav.arrayBuffer());
      const digest = await globalThis.crypto.subtle.digest("SHA-256", wavBytes);
      const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
      results.push({
        voiceId,
        speakerId: output.speakerId,
        sampleRate: output.sampleRate,
        sampleCount: output.audio.length,
        durationMs,
        peak: metrics.peak,
        rms: metrics.rms,
        wavBytes: Array.from(wavBytes),
        sha256
      });
    }

    const speakerIds = new Set(results.map(result => result.speakerId));
    if (speakerIds.size !== EXPECTED_VOICES.length) {
      throw new Error("The three configured voices did not resolve to three distinct ONNX speaker IDs.");
    }
    return {
      modelId: model.modelId,
      modelBytes: model.modelBytes,
      dialogue: TEST_DIALOGUE,
      availableVoices,
      results
    };
  } finally {
    runtime.dispose();
  }
}

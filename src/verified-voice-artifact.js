import { readWavPcmMetadata } from "./wav-pcm-metadata.js";

const toHex = bytes => [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join("");

/**
 * Validates a generated integer-PCM WAV, derives its identity from its bytes,
 * and persists it through the local voice-audio storage adapter.
 * No network requests are made.
 */
export function createVerifiedVoiceArtifactStore({
  storage,
  cryptoRef = globalThis.crypto,
  durationToleranceMs = 50
} = {}) {
  if (!storage || typeof storage.put !== "function" || typeof storage.get !== "function") {
    throw new TypeError("A voice audio storage adapter with put() and get() is required.");
  }
  if (!cryptoRef?.subtle || typeof cryptoRef.subtle.digest !== "function") {
    throw new Error("Web Crypto SHA-256 is not available in this browser.");
  }
  if (!Number.isFinite(durationToleranceMs) || durationToleranceMs < 0 || durationToleranceMs > 1000) {
    throw new RangeError("durationToleranceMs must be between 0 and 1000.");
  }

  return {
    async save({ blob, filename = "voice-audio.wav", engineUsed = "", expectedDurationMs = null, expectedSampleRate = null } = {}) {
      if (typeof Blob === "undefined" || !(blob instanceof Blob)) {
        throw new TypeError("Generated voice output must be a Blob.");
      }
      if (blob.size === 0) throw new Error("Generated voice output is empty.");
      const mime = String(blob.type || "").toLowerCase().split(";")[0].trim();
      if (mime && !["audio/wav", "audio/x-wav", "audio/wave", "application/octet-stream"].includes(mime)) {
        throw new Error("Only PCM WAV voice artifacts can be verified by this adapter.");
      }

      const parsed = await readWavPcmMetadata(blob);
      if (expectedSampleRate != null && Number(expectedSampleRate) !== parsed.sampleRate) {
        throw new Error("Generated WAV sample rate does not match the provider result metadata.");
      }
      if (expectedDurationMs != null) {
        const expected = Number(expectedDurationMs);
        if (!Number.isFinite(expected) || expected <= 0) {
          throw new RangeError("expectedDurationMs must be a finite positive number.");
        }
        const tolerance = Math.max(durationToleranceMs, expected * 0.02);
        if (Math.abs(expected - parsed.durationMs) > tolerance) {
          throw new Error("Generated WAV duration does not match the provider result metadata.");
        }
      }

      const bytes = await blob.arrayBuffer();
      const digest = await cryptoRef.subtle.digest("SHA-256", bytes);
      const audioHash = toHex(digest);
      const metadata = {
        filename: String(filename || "voice-audio.wav").slice(0, 180),
        mimeType: mime || "audio/wav",
        engineUsed: String(engineUsed || "").slice(0, 80),
        durationMs: parsed.durationMs,
        sampleRate: parsed.sampleRate
      };
      const record = await storage.put(audioHash, blob, metadata);
      return {
        audioHash,
        durationMs: parsed.durationMs,
        sampleRate: parsed.sampleRate,
        channels: parsed.channels,
        bitsPerSample: parsed.bitsPerSample,
        byteSize: blob.size,
        record
      };
    },

    async get(audioHash) {
      return storage.get(audioHash);
    }
  };
}

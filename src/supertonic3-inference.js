/*
 * Adapted from the MIT-licensed Supertonic browser helper:
 * https://github.com/supertone-oss-archive/supertonic/blob/main/web/helper.js
 * Model weights remain subject to OpenRAIL-M.
 */
function assertActive(signal) {
  if (signal?.aborted) {
    const error = new Error("Supertonic speech synthesis was cancelled.");
    error.name = "AbortError";
    throw error;
  }
}

function report(callback, detail) {
  if (typeof callback !== "function") return;
  try { callback(Object.freeze({ ...detail })); } catch { /* UI callback isolation. */ }
}

function normalizeText(value, locale) {
  const supported = ["ru", "uk", "en", "ko", "ja", "ar", "bg", "cs", "da", "de", "el", "es", "et", "fi", "fr", "hi", "hr", "hu", "id", "it", "lt", "lv", "nl", "pl", "pt", "ro", "sk", "sl", "sv", "tr", "vi"];
  if (!supported.includes(locale)) throw new RangeError("Unsupported Supertonic 3 language.");
  let text = String(value ?? "").normalize("NFKD");
  text = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu, "");
  text = text.replace(/[–‑—]/g, "-").replace(/[_\[\]|\/#→←]/g, " ");
  text = text.replace(/[♥☆♡©\\]/g, "").replace(/\s+/g, " ").trim();
  if (!text) throw new TypeError("Dialogue text is empty after normalization.");
  if (!/[.!?;:,'")\]}…。」』】〉》›»]$/u.test(text)) text += ".";
  return "<" + locale + ">" + text + "</" + locale + ">";
}

function splitText(text, maxLength = 300) {
  const paragraphs = String(text).trim().split(/\n\s*\n+/u).filter(Boolean);
  const chunks = [];
  for (const paragraph of paragraphs) {
    const sentences = paragraph.split(/(?<=[.!?])\s+/u);
    let current = "";
    for (const sentence of sentences) {
      for (const word of sentence.split(/\s+/u).filter(Boolean)) {
        const next = current ? current + " " + word : word;
        if (next.length > maxLength && current) {
          chunks.push(current);
          current = word;
        } else current = next;
        if (current.length > maxLength) { chunks.push(current); current = ""; }
      }
      if (current && /[.!?]$/u.test(current)) { chunks.push(current); current = ""; }
    }
    if (current) chunks.push(current);
  }
  return chunks.filter(Boolean);
}

function makeWav(samples, sampleRate) {
  if (!samples.length || !Number.isFinite(sampleRate) || sampleRate <= 0) throw new TypeError("Cannot encode empty or invalid speech audio.");
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const write = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  write(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); write(8, "WAVE");
  write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, dataSize, true);
  const pcm = new DataView(buffer, 44);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, Number(samples[i]) || 0));
    pcm.setInt16(i * 2, Math.round(value * 32767), true);
  }
  return buffer;
}

function gaussianNoise(length) {
  const values = new Float32Array(length);
  for (let i = 0; i < length; i += 2) {
    const u1 = Math.max(0.0001, Math.random());
    const u2 = Math.random();
    const radius = Math.sqrt(-2 * Math.log(u1));
    values[i] = radius * Math.cos(2 * Math.PI * u2);
    if (i + 1 < length) values[i + 1] = radius * Math.sin(2 * Math.PI * u2);
  }
  return values;
}

async function synthesizeChunk(state, text, style, steps, speed, signal, onProgress, chunk, chunks) {
  assertActive(signal);
  const processed = normalizeText(text, state.locale);
  const tokens = Array.from(processed, char => {
    const token = state.unicodeIndexer[char.codePointAt(0)];
    return Number.isInteger(token) ? token : -1;
  });
  const Tensor = state.ort.Tensor;
  const textIds = new Tensor("int64", BigInt64Array.from(tokens, value => BigInt(value)), [1, tokens.length]);
  const textMask = new Tensor("float32", new Float32Array(tokens.length).fill(1), [1, 1, tokens.length]);

  const durationResult = await state.sessions.durationPredictor.run({ text_ids: textIds, style_dp: style.styleDp, text_mask: textMask });
  assertActive(signal);
  const duration = Number(durationResult?.duration?.data?.[0]) / speed;
  if (!Number.isFinite(duration) || duration <= 0 || duration > 60) throw new RangeError("Supertonic predicted an invalid or excessive dialogue duration.");

  const encoded = await state.sessions.textEncoder.run({ text_ids: textIds, style_ttl: style.styleTtl, text_mask: textMask });
  assertActive(signal);
  const textEmbedding = encoded?.text_emb;
  if (!textEmbedding?.data || !Array.isArray(textEmbedding.dims)) throw new Error("Supertonic text encoder returned an invalid embedding.");

  const config = state.config;
  const sampleRate = Number(config?.ae?.sample_rate);
  const baseChunk = Number(config?.ae?.base_chunk_size);
  const compression = Number(config?.ttl?.chunk_compress_factor);
  const latentDim = Number(config?.ttl?.latent_dim);
  if (![sampleRate, baseChunk, compression, latentDim].every(Number.isFinite) || Math.min(sampleRate, baseChunk, compression, latentDim) <= 0) {
    throw new Error("Supertonic model configuration is incomplete.");
  }
  const sampleCount = Math.floor(duration * sampleRate);
  const latentLength = Math.max(1, Math.ceil(sampleCount / (baseChunk * compression)));
  const channels = latentDim * compression;
  const latentMaskData = new Float32Array(latentLength).fill(1);
  const latentMask = new Tensor("float32", latentMaskData, [1, 1, latentLength]);
  const totalStep = new Tensor("float32", new Float32Array([steps]), [1]);
  let latentData = gaussianNoise(channels * latentLength);

  for (let step = 0; step < steps; step++) {
    assertActive(signal);
    const latent = new Tensor("float32", latentData, [1, channels, latentLength]);
    const currentStep = new Tensor("float32", new Float32Array([step]), [1]);
    const result = await state.sessions.vectorEstimator.run({
      noisy_latent: latent, text_emb: textEmbedding, style_ttl: style.styleTtl,
      latent_mask: latentMask, text_mask: textMask, current_step: currentStep, total_step: totalStep
    });
    assertActive(signal);
    const denoised = result?.denoised_latent?.data;
    if (!denoised || denoised.length !== latentData.length) throw new Error("Supertonic vector estimator returned an invalid latent tensor.");
    latentData = Float32Array.from(denoised);
    report(onProgress, { phase: "synthesizing", chunk, chunks, step: step + 1, totalSteps: steps });
  }

  const latent = new Tensor("float32", latentData, [1, channels, latentLength]);
  const vocoder = await state.sessions.vocoder.run({ latent });
  assertActive(signal);
  const waveform = vocoder?.wav_tts?.data;
  if (!waveform?.length || Array.from(waveform).some(value => !Number.isFinite(Number(value)))) throw new Error("Supertonic vocoder returned invalid audio samples.");
  return { samples: Float32Array.from(waveform), sampleRate };
}

export async function synthesizeSupertonic3Speech({ state, text, voiceId, totalStep = 5, speed = 1.05, signal, onProgress, loadVoiceStyle }) {
  assertActive(signal);
  if (!state) throw new Error("Load the Supertonic 3 ONNX sessions first.");
  if (!Number.isInteger(totalStep) || totalStep < 1 || totalStep > 12) throw new RangeError("totalStep must be from 1 to 12.");
  if (!Number.isFinite(speed) || speed < 0.7 || speed > 2) throw new RangeError("speed must be between 0.7 and 2.");
  const style = await loadVoiceStyle(voiceId, { signal, onProgress });
  const chunks = splitText(text);
  if (!chunks.length) throw new TypeError("Dialogue text is empty.");
  const parts = [];
  let sampleRate = 0;
  for (let index = 0; index < chunks.length; index++) {
    const part = await synthesizeChunk(state, chunks[index], style, totalStep, speed, signal, onProgress, index + 1, chunks.length);
    if (sampleRate && sampleRate !== part.sampleRate) throw new Error("Supertonic returned inconsistent sample rates.");
    sampleRate = part.sampleRate;
    if (index) parts.push(new Float32Array(Math.floor(sampleRate * 0.3)));
    parts.push(part.samples);
  }
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const samples = new Float32Array(length);
  let offset = 0;
  for (const part of parts) { samples.set(part, offset); offset += part.length; }
  const arrayBuffer = makeWav(samples, sampleRate);
  const blob = new Blob([arrayBuffer], { type: "audio/wav" });
  report(onProgress, { phase: "audio-ready", voiceId: style.voiceId, bytes: arrayBuffer.byteLength, duration: samples.length / sampleRate });
  return Object.freeze({ blob, arrayBuffer, mimeType: "audio/wav", sampleRate, duration: samples.length / sampleRate, sampleCount: samples.length, voiceId: style.voiceId });
}

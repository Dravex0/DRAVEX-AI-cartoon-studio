/**
 * Estimate mouth openness from a decoded local voice recording.
 * Uses a short RMS window around the requested offset; no network or media upload.
 */
export function sampleDialogueMouthOpen(audioBuffer, elapsedMs, windowMs = 32) {
  if (!audioBuffer || typeof audioBuffer.getChannelData !== 'function' ||
      !Number.isFinite(audioBuffer.sampleRate) || audioBuffer.sampleRate <= 0 ||
      !Number.isFinite(elapsedMs) || elapsedMs < 0) return 0;
  const length = Number(audioBuffer.length);
  if (!Number.isInteger(length) || length <= 0) return 0;
  const channels = Math.max(1, Math.floor(Number(audioBuffer.numberOfChannels) || 1));
  const center = Math.min(length - 1, Math.floor(elapsedMs * audioBuffer.sampleRate / 1000));
  const halfWindow = Math.max(1, Math.floor(audioBuffer.sampleRate * Math.max(8, Math.min(80, windowMs)) / 2000));
  const start = Math.max(0, center - halfWindow);
  const end = Math.min(length, center + halfWindow + 1);
  let sumSquares = 0, samples = 0;
  for (let channel = 0; channel < channels; channel++) {
    const data = audioBuffer.getChannelData(channel);
    if (!data || data.length < end) continue;
    for (let index = start; index < end; index++) {
      const value = Number(data[index]) || 0;
      sumSquares += value * value;
      samples++;
    }
  }
  if (!samples) return 0;
  const rms = Math.sqrt(sumSquares / samples);
  return Math.max(0, Math.min(1, (rms - 0.012) * 5.5));
}

/** Precompute a compact, smoothed RMS envelope once after local audio decoding. */
export function createDialogueMouthEnvelope(audioBuffer, { windowMs = 32, hopMs = 16, noiseFloor = 0.012, sensitivity = 5.5, attack = 0.62, release = 0.28 } = {}) {
  if (!audioBuffer || typeof audioBuffer.getChannelData !== 'function' || !Number.isFinite(audioBuffer.sampleRate) || audioBuffer.sampleRate <= 0) return null;
  const length = Number(audioBuffer.length);
  const channels = Math.max(1, Math.floor(Number(audioBuffer.numberOfChannels) || 1));
  if (!Number.isInteger(length) || length <= 0) return null;
  const rate = audioBuffer.sampleRate;
  const hopSamples = Math.max(1, Math.floor(rate * Math.max(8, Math.min(80, hopMs)) / 1000));
  const halfWindow = Math.max(1, Math.floor(rate * Math.max(8, Math.min(100, windowMs)) / 2000));
  const channelData = Array.from({ length: channels }, (_, channel) => audioBuffer.getChannelData(channel));
  const values = new Float32Array(Math.ceil(length / hopSamples));
  let previous = 0;
  for (let frame = 0; frame < values.length; frame++) {
    const center = frame * hopSamples, start = Math.max(0, center - halfWindow), end = Math.min(length, center + halfWindow + 1);
    let sumSquares = 0, count = 0;
    for (const data of channelData) if (data) for (let i = start; i < end; i++) { const sample = Number(data[i]) || 0; sumSquares += sample * sample; count++; }
    const rms = count ? Math.sqrt(sumSquares / count) : 0;
    const target = Math.max(0, Math.min(1, (rms - noiseFloor) * sensitivity));
    previous += (target - previous) * Math.max(0, Math.min(1, target > previous ? attack : release));
    values[frame] = previous;
  }
  return { values, hopMs: hopSamples * 1000 / rate, durationMs: length * 1000 / rate };
}

/** Read the precomputed mouth envelope at a cue-local millisecond offset. */
export function sampleDialogueMouthEnvelope(envelope, elapsedMs) {
  if (!envelope || !(envelope.values instanceof Float32Array) || !Number.isFinite(envelope.hopMs) || envelope.hopMs <= 0 || !Number.isFinite(elapsedMs) || elapsedMs < 0 || !envelope.values.length) return 0;
  const position = Math.min(envelope.values.length - 1, elapsedMs / envelope.hopMs);
  const left = Math.floor(position), right = Math.min(envelope.values.length - 1, left + 1), fraction = position - left;
  return Math.max(0, Math.min(1, envelope.values[left] * (1 - fraction) + envelope.values[right] * fraction));
}

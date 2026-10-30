/**
 * Estimate mouth openness from a decoded local voice recording.
 * Uses a short RMS window around the requested offset; no network or media upload.
 */
function finiteClamp(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

export function sampleDialogueMouthOpen(audioBuffer, elapsedMs, windowMs = 32) {
  if (!audioBuffer || typeof audioBuffer.getChannelData !== 'function' ||
      !Number.isFinite(audioBuffer.sampleRate) || audioBuffer.sampleRate <= 0 ||
      !Number.isFinite(elapsedMs) || elapsedMs < 0) return 0;
  const length = Number(audioBuffer.length);
  if (!Number.isInteger(length) || length <= 0) return 0;
  const channels = Math.max(1, Math.floor(Number(audioBuffer.numberOfChannels) || 1));
  const center = Math.min(length - 1, Math.floor(elapsedMs * audioBuffer.sampleRate / 1000));
  const safeWindowMs = finiteClamp(windowMs, 32, 8, 80);
  const halfWindow = Math.max(1, Math.floor(audioBuffer.sampleRate * safeWindowMs / 2000));
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

/** Precompute a compact, smoothed RMS envelope once after local audio decoding.
 * Uses a rolling sum of squared samples so overlapping RMS windows are O(samples),
 * rather than rescanning the full window for every output frame.
 */
export function createDialogueMouthEnvelope(audioBuffer, { windowMs = 32, hopMs = 16, noiseFloor = 0.012, sensitivity = 5.5, attack = 0.62, release = 0.28 } = {}) {
  if (!audioBuffer || typeof audioBuffer.getChannelData !== 'function' || !Number.isFinite(audioBuffer.sampleRate) || audioBuffer.sampleRate <= 0) return null;
  const length = Number(audioBuffer.length);
  const channels = Math.max(1, Math.floor(Number(audioBuffer.numberOfChannels) || 1));
  if (!Number.isInteger(length) || length <= 0) return null;
  const rate = audioBuffer.sampleRate;
  const safeHopMs = finiteClamp(hopMs, 16, 8, 80);
  const safeWindowMs = finiteClamp(windowMs, 32, 8, 100);
  const safeNoiseFloor = finiteClamp(noiseFloor, 0.012, 0, 1);
  const safeSensitivity = finiteClamp(sensitivity, 5.5, 0, 100);
  const safeAttack = finiteClamp(attack, 0.62, 0, 1);
  const safeRelease = finiteClamp(release, 0.28, 0, 1);
  const hopSamples = Math.max(1, Math.floor(rate * safeHopMs / 1000));
  const halfWindow = Math.max(1, Math.floor(rate * safeWindowMs / 2000));
  const channelData = Array.from({ length: channels }, (_, channel) => audioBuffer.getChannelData(channel));
  const values = new Float32Array(Math.ceil(length / hopSamples));
  let previous = 0, windowStart = 0, windowEnd = 0, sumSquares = 0, count = 0;
  const addRange = (from, to) => {
    for (const data of channelData) if (data) for (let i = from; i < to; i++) {
      const sample = Number(data[i]) || 0;
      sumSquares += sample * sample;
      count++;
    }
  };
  const removeRange = (from, to) => {
    for (const data of channelData) if (data) for (let i = from; i < to; i++) {
      const sample = Number(data[i]) || 0;
      sumSquares -= sample * sample;
      count--;
    }
  };
  for (let frame = 0; frame < values.length; frame++) {
    const center = frame * hopSamples;
    const nextStart = Math.max(0, center - halfWindow);
    const nextEnd = Math.min(length, center + halfWindow + 1);
    if (frame > 0 && nextStart >= windowEnd) {
      sumSquares = 0;
      count = 0;
      windowStart = nextStart;
      windowEnd = nextStart;
    } else if (nextStart > windowStart) {
      removeRange(windowStart, Math.min(nextStart, windowEnd));
    }
    if (nextEnd > windowEnd) addRange(windowEnd, nextEnd);
    windowStart = nextStart;
    windowEnd = nextEnd;
    const rms = count > 0 ? Math.sqrt(Math.max(0, sumSquares) / count) : 0;
    const target = Math.max(0, Math.min(1, (rms - safeNoiseFloor) * safeSensitivity));
    previous += (target - previous) * (target > previous ? safeAttack : safeRelease);
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

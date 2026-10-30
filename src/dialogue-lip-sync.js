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

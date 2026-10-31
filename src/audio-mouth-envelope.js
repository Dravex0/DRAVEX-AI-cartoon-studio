const MIN_FPS = 1;
const MAX_FPS = 60;
const MAX_DURATION_MS = 30_000;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function normalizeChannels(channels) {
  if (!Array.isArray(channels) || channels.length === 0) {
    throw new TypeError("At least one audio channel is required.");
  }
  const normalized = channels.map((channel, index) => {
    if (!(channel instanceof Float32Array) && !Array.isArray(channel)) {
      throw new TypeError(`Audio channel ${index + 1} must be a Float32Array or number array.`);
    }
    if (channel.length === 0) throw new RangeError("Audio channels must not be empty.");
    return channel;
  });
  const length = normalized[0].length;
  if (normalized.some(channel => channel.length !== length)) {
    throw new RangeError("All audio channels must have the same sample count.");
  }
  return normalized;
}

/**
 * Convert decoded dialogue samples into a frame-based mouth-opening envelope.
 * This is audio-energy lip movement, not phoneme/viseme recognition.
 * Input samples should come from a decoded dialogue WAV, not a music mix.
 */
export function buildAudioMouthEnvelope({
  channels,
  sampleRate,
  fps = 24,
  noiseFloor = 0.008,
  fullOpenRms = 0.12,
  attackMs = 35,
  releaseMs = 95
} = {}) {
  const audioChannels = normalizeChannels(channels);
  if (!Number.isInteger(sampleRate) || sampleRate < 8_000 || sampleRate > 192_000) {
    throw new RangeError("sampleRate must be an integer between 8000 and 192000.");
  }
  if (!Number.isFinite(fps) || fps < MIN_FPS || fps > MAX_FPS) {
    throw new RangeError(`fps must be between ${MIN_FPS} and ${MAX_FPS}.`);
  }
  if (!Number.isFinite(noiseFloor) || noiseFloor < 0 || !Number.isFinite(fullOpenRms) || fullOpenRms <= noiseFloor) {
    throw new RangeError("fullOpenRms must be finite and greater than a non-negative noiseFloor.");
  }
  if (!Number.isFinite(attackMs) || attackMs <= 0 || !Number.isFinite(releaseMs) || releaseMs <= 0) {
    throw new RangeError("attackMs and releaseMs must be finite positive numbers.");
  }

  const sampleCount = audioChannels[0].length;
  const durationMs = sampleCount / sampleRate * 1000;
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_DURATION_MS) {
    throw new RangeError("Dialogue audio duration must be greater than 0 and no more than 30 seconds.");
  }

  const frameCount = Math.ceil(durationMs * fps / 1000);
  const frameMs = 1000 / fps;
  const frames = new Array(frameCount);
  let previous = 0;

  for (let frame = 0; frame < frameCount; frame++) {
    const start = Math.floor(frame * sampleRate / fps);
    const end = Math.min(sampleCount, Math.max(start + 1, Math.floor((frame + 1) * sampleRate / fps)));
    let sumSquares = 0;
    let sampleTotal = 0;
    for (const channel of audioChannels) {
      for (let sampleIndex = start; sampleIndex < end; sampleIndex++) {
        const sample = Number(channel[sampleIndex]);
        const safeSample = Number.isFinite(sample) ? sample : 0;
        sumSquares += safeSample * safeSample;
        sampleTotal++;
      }
    }
    const rms = sampleTotal ? Math.sqrt(sumSquares / sampleTotal) : 0;
    const target = clamp((rms - noiseFloor) / (fullOpenRms - noiseFloor), 0, 1);
    const timeConstant = target > previous ? attackMs : releaseMs;
    const smoothing = 1 - Math.exp(-frameMs / timeConstant);
    previous = clamp(previous + (target - previous) * smoothing, 0, 1);
    frames[frame] = previous;
  }

  return Object.freeze({
    fps,
    frameCount,
    durationMs,
    frames: Object.freeze(frames)
  });
}

/** Read interpolated mouth openness at a dialogue-relative time in milliseconds. */
export function sampleAudioMouthEnvelope(envelope, timeMs) {
  if (!envelope || !Array.isArray(envelope.frames) || !Number.isFinite(envelope.fps) || envelope.fps <= 0) {
    throw new TypeError("A valid audio mouth envelope is required.");
  }
  if (!Number.isFinite(timeMs)) throw new TypeError("timeMs must be finite.");
  if (timeMs < 0 || timeMs >= envelope.durationMs || envelope.frames.length === 0) return 0;

  const position = timeMs * envelope.fps / 1000;
  const leftIndex = Math.min(envelope.frames.length - 1, Math.floor(position));
  const rightIndex = Math.min(envelope.frames.length - 1, leftIndex + 1);
  const fraction = position - leftIndex;
  const left = clamp(Number(envelope.frames[leftIndex]) || 0, 0, 1);
  const right = clamp(Number(envelope.frames[rightIndex]) || 0, 0, 1);
  return left + (right - left) * fraction;
}

const MIN_DURATION_MS = 1;
const MAX_DURATION_MS = 30_000;
const MIN_FPS = 1;
const MAX_FPS = 60;

const SHAPES = new Set(["neutral", "open", "wide", "round", "closed", "teeth"]);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function graphemes(value) {
  const text = String(value ?? "");
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)]
      .map(item => item.segment.toLowerCase());
  }
  return Array.from(text.toLowerCase());
}

function shapeForPhoneme(phoneme) {
  const base = String(phoneme || "").normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
  if (/^[bmpɱ]$/u.test(base)) return "closed";
  if (/^[fvθð]$/u.test(base)) return "teeth";
  if (/^[aɑæɐʌ]$/u.test(base)) return "open";
  if (/^[iɪeɛɨɘ]$/u.test(base)) return "wide";
  if (/^[uʊoɔɒʉyøœ]$/u.test(base)) return "round";
  return "neutral";
}

function buildChunkGuidedFrames({ phonemeChunks, durationMs, fps, frameCount }) {
  if (!Array.isArray(phonemeChunks) || phonemeChunks.length === 0) return null;
  if (phonemeChunks.length > 120) throw new RangeError("phonemeChunks must contain at most 120 chunks.");
  const frames = new Array(frameCount).fill("neutral");
  let previousEndMs = 0;
  for (const chunk of phonemeChunks) {
    const startMs = Number(chunk?.startMs);
    const endMs = Number(chunk?.endMs);
    const symbols = graphemes(chunk?.phonemes || "");
    if (!symbols.length || !Number.isFinite(startMs) || !Number.isFinite(endMs)
      || startMs < previousEndMs - 0.5 || endMs <= startMs || endMs > durationMs + 2) {
      throw new RangeError("phonemeChunks contains invalid chunk timing or phonemes.");
    }
    previousEndMs = endMs;
    const weighted = symbols.map(symbol => {
      const shape = shapeForPhoneme(symbol);
      const weight = shape === "neutral" ? 0.7 : shape === "closed" ? 0.85 : 1.1;
      return { shape, weight };
    });
    const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
    let cursor = 0;
    let boundary = startMs + weighted[0].weight / totalWeight * (endMs - startMs);
    for (let frame = 0; frame < frameCount; frame++) {
      const timeMs = (frame + 0.5) * 1000 / fps;
      if (timeMs < startMs || timeMs >= endMs) continue;
      while (cursor < weighted.length - 1 && timeMs >= boundary) {
        cursor++;
        boundary += weighted[cursor].weight / totalWeight * (endMs - startMs);
      }
      frames[frame] = weighted[cursor].shape;
    }
  }
  return frames;
}

function shapeForGrapheme(grapheme, language) {
  if (/^[.!?,;:…—–-]$/u.test(grapheme)) return "neutral";
  if (/^\s+$/u.test(grapheme)) return "neutral";

  const lang = String(language || "en").toLowerCase().split("-")[0];
  if (/^[bmpмбп]$/u.test(grapheme)) return "closed";
  if (/^[fvфв]$/u.test(grapheme)) return "teeth";

  if (lang === "ru" || lang === "uk") {
    if (/^[а-яёіїєґ]$/u.test(grapheme)) {
      if (/^[а-яёіїєґ]$/u.test(grapheme)) {
        if (/^[аая]$/u.test(grapheme)) return "open";
        if (/^[эеиіїє]$/u.test(grapheme)) return "wide";
        if (/^[оёоуую]$/u.test(grapheme)) return "round";
      }
    }
    return "neutral";
  }

  if (/^[a]$/u.test(grapheme)) return "open";
  if (/^[eiy]$/u.test(grapheme)) return "wide";
  if (/^[ou]$/u.test(grapheme)) return "round";
  return "neutral";
}

/**
 * Approximate text-guided viseme schedule.
 * This is not phoneme recognition or forced alignment: graphemes are spread
 * across the measured WAV duration and later gated by its real audio envelope.
 */
export function buildVisemeTimeline({ text, durationMs, language = "en", fps = 24, phonemeChunks = null } = {}) {
  const source = String(text ?? "").trim();
  if (!source) throw new TypeError("Dialogue text is required.");
  if (!Number.isFinite(durationMs) || durationMs < MIN_DURATION_MS || durationMs > MAX_DURATION_MS) {
    throw new RangeError("durationMs must be between 1 and 30000.");
  }
  if (!Number.isFinite(fps) || fps < MIN_FPS || fps > MAX_FPS) {
    throw new RangeError("fps must be between 1 and 60.");
  }

  const frameCount = Math.max(1, Math.ceil(durationMs * fps / 1000));
  const chunkFrames = buildChunkGuidedFrames({ phonemeChunks, durationMs, fps, frameCount });
  if (chunkFrames) {
    return Object.freeze({
      fps,
      frameCount,
      durationMs,
      language: String(language || "en").slice(0, 8),
      source: "kokoro-phoneme-chunks",
      alignment: "measured-chunk-bounds-with-approximate-within-chunk-phoneme-timing",
      frames: Object.freeze(chunkFrames)
    });
  }

  const units = graphemes(source);
  if (!units.length || units.length > 2000) throw new RangeError("Dialogue text must contain 1 to 2000 graphemes.");
  const weighted = units.map(grapheme => {
    const shape = shapeForGrapheme(grapheme, language);
    const weight = /^\s+$/u.test(grapheme) ? 0.45
      : /^[.!?,;:…—–-]$/u.test(grapheme) ? 1.25
      : shape === "neutral" ? 0.72 : shape === "closed" ? 0.82 : 1.15;
    return { shape, weight };
  });
  const totalWeight = weighted.reduce((sum, unit) => sum + unit.weight, 0);
  const frames = new Array(frameCount);
  let cursor = 0;
  let boundary = weighted[0].weight / totalWeight * durationMs;

  for (let frame = 0; frame < frameCount; frame++) {
    const timeMs = (frame + 0.5) * 1000 / fps;
    while (cursor < weighted.length - 1 && timeMs >= boundary) {
      cursor++;
      boundary += weighted[cursor].weight / totalWeight * durationMs;
    }
    frames[frame] = weighted[cursor].shape;
  }

  return Object.freeze({
    fps,
    frameCount,
    durationMs,
    language: String(language || "en").slice(0, 8),
    source: "text-grapheme-fallback",
    alignment: "approximate-text-distribution",
    frames: Object.freeze(frames)
  });
}

/** Return the approximate viseme label at dialogue-relative time in ms. */
export function sampleVisemeTimeline(timeline, timeMs) {
  if (!timeline || !Array.isArray(timeline.frames) || !Number.isFinite(timeline.fps) || timeline.fps <= 0) {
    throw new TypeError("A valid viseme timeline is required.");
  }
  if (!Number.isFinite(timeMs)) throw new TypeError("timeMs must be finite.");
  if (timeMs < 0 || timeMs >= timeline.durationMs || timeline.frames.length === 0) return "neutral";
  const index = Math.min(timeline.frames.length - 1, Math.floor(timeMs * timeline.fps / 1000));
  const shape = timeline.frames[index];
  return SHAPES.has(shape) ? shape : "neutral";
}

const MAX_EVENTS = 2000;
const MAX_DURATION_MS = 30_000;

const OCULUS_SHAPES = Object.freeze({
  PP: "closed",
  FF: "teeth",
  TH: "teeth",
  aa: "open",
  I: "wide",
  E: "wide",
  O: "round",
  U: "round",
  nn: "neutral",
  kk: "neutral",
  DD: "neutral",
  CH: "teeth",
  SS: "teeth",
  RR: "neutral"
});

/**
 * Convert HeadTTS/Kokoro model-derived viseme timestamps into DRAVEX mouth events.
 * HeadTTS computes these times from the timestamped model's token duration output.
 */
export function buildTimestampedKokoroVisemeEvents({
  visemes,
  vtimes,
  vdurations,
  durationMs
} = {}) {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_DURATION_MS) {
    throw new RangeError("durationMs must be between 0 and 30000.");
  }
  if (!Array.isArray(visemes) || !Array.isArray(vtimes) || !Array.isArray(vdurations)
    || visemes.length !== vtimes.length || visemes.length !== vdurations.length) {
    throw new TypeError("visemes, vtimes and vdurations must be arrays of equal length.");
  }
  if (visemes.length === 0 || visemes.length > MAX_EVENTS) {
    throw new RangeError("The timestamped viseme result must contain 1 to 2000 events.");
  }

  const events = [];
  let previousStartMs = -1;
  for (let index = 0; index < visemes.length; index++) {
    const label = String(visemes[index] ?? "");
    const startMs = Number(vtimes[index]);
    const rawDurationMs = Number(vdurations[index]);
    if (!Object.hasOwn(OCULUS_SHAPES, label)
      || !Number.isFinite(startMs) || !Number.isFinite(rawDurationMs)
      || startMs < 0 || rawDurationMs <= 0 || startMs < previousStartMs
      || startMs >= durationMs + 50 || startMs + rawDurationMs > durationMs + 50) {
      throw new RangeError("Invalid timestamped Kokoro viseme at index " + index + ".");
    }
    previousStartMs = startMs;
    const endMs = Math.min(durationMs, startMs + rawDurationMs);
    if (endMs > startMs) {
      events.push({
        shape: OCULUS_SHAPES[label],
        startMs,
        durationMs: endMs - startMs
      });
    }
  }
  return Object.freeze(events.map(event => Object.freeze(event)));
}

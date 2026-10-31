/**
 * Accumulate animation time only while playback is active.
 * This keeps motion speed independent of the display refresh rate and pauses.
 */
export function createAnimationClock(initialTimeMs = 0) {
  if (!Number.isFinite(initialTimeMs) || initialTimeMs < 0) {
    throw new RangeError("initialTimeMs must be a non-negative finite number.");
  }

  let elapsedMs = initialTimeMs;
  let lastTimestampMs = null;

  return {
    advance(timestampMs, isPlaying) {
      if (!Number.isFinite(timestampMs) || timestampMs < 0) {
        throw new RangeError("timestampMs must be a non-negative finite number.");
      }
      if (typeof isPlaying !== "boolean") {
        throw new TypeError("isPlaying must be a boolean.");
      }
      if (!isPlaying) {
        lastTimestampMs = null;
        return elapsedMs;
      }
      if (lastTimestampMs === null) {
        lastTimestampMs = timestampMs;
      } else if (timestampMs >= lastTimestampMs) {
        elapsedMs += timestampMs - lastTimestampMs;
        lastTimestampMs = timestampMs;
      }
      return elapsedMs;
    },
    reset(nextTimeMs = 0) {
      if (!Number.isFinite(nextTimeMs) || nextTimeMs < 0) {
        throw new RangeError("nextTimeMs must be a non-negative finite number.");
      }
      elapsedMs = nextTimeMs;
      lastTimestampMs = null;
      return elapsedMs;
    },
    getElapsedMs() {
      return elapsedMs;
    }
  };
}

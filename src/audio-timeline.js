const MAX_AUDIO_CUES = 30;
const MIN_FPS = 1;
const MAX_FPS = 60;

/**
 * Build a provider-neutral audio schedule from already generated audio artifacts.
 * durationMs must come from the actual audio file, not a text-length estimate.
 * Time intervals are half-open: [startMs, endMs).
 */
export function buildAudioTimeline(cues, fps = 24) {
  if (!Number.isFinite(fps) || fps < MIN_FPS || fps > MAX_FPS) {
    throw new RangeError(`fps must be a finite number between ${MIN_FPS} and ${MAX_FPS}.`);
  }
  if (!Array.isArray(cues)) {
    throw new TypeError('Audio cues must be an array.');
  }
  if (cues.length > MAX_AUDIO_CUES) {
    throw new RangeError(`Audio timeline supports at most ${MAX_AUDIO_CUES} cues.`);
  }

  const frameDurationMs = 1000 / fps;
  const seenCueIds = new Set();
  const tracks = cues.map((cue, index) => {
    if (!cue || typeof cue !== 'object' || Array.isArray(cue)) {
      throw new TypeError(`Audio cue at index ${index} must be an object.`);
    }

    const cueId = typeof cue.cueId === 'string' ? cue.cueId.trim() : '';
    const characterName = typeof cue.characterName === 'string' ? cue.characterName.trim() : '';
    if (!cueId) throw new TypeError(`Audio cue at index ${index} requires cueId.`);
    if (seenCueIds.has(cueId)) throw new TypeError(`Duplicate audio cueId: ${cueId}.`);
    seenCueIds.add(cueId);
    if (!characterName) throw new TypeError(`Audio cue '${cueId}' requires characterName.`);
    if (!Number.isInteger(cue.startFrame) || cue.startFrame < 0) {
      throw new RangeError(`Audio cue '${cueId}' startFrame must be a non-negative integer.`);
    }
    if (!Number.isFinite(cue.durationMs) || cue.durationMs <= 0) {
      throw new RangeError(`Audio cue '${cueId}' durationMs must be a finite positive number.`);
    }

    const startMs = cue.startFrame * frameDurationMs;
    const endMs = startMs + cue.durationMs;
    const endFrame = Math.ceil((endMs * fps) / 1000 - 1e-10);
    const audioHash = typeof cue.audioHash === 'string' && cue.audioHash.trim()
      ? cue.audioHash.trim()
      : null;

    return {
      cueId,
      characterName,
      startFrame: cue.startFrame,
      startMs,
      durationMs: cue.durationMs,
      endMs,
      endFrame,
      audioHash
    };
  });

  const overlaps = [];
  let maxEndMs = 0;
  for (const track of tracks) maxEndMs = Math.max(maxEndMs, track.endMs);

  for (let i = 0; i < tracks.length; i++) {
    for (let j = i + 1; j < tracks.length; j++) {
      const a = tracks[i];
      const b = tracks[j];
      const overlapStartMs = Math.max(a.startMs, b.startMs);
      const overlapEndMs = Math.min(a.endMs, b.endMs);
      if (overlapStartMs < overlapEndMs) {
        overlaps.push({
          cueA: a.cueId,
          characterA: a.characterName,
          cueB: b.cueId,
          characterB: b.characterName,
          startMs: overlapStartMs,
          endMs: overlapEndMs,
          durationMs: overlapEndMs - overlapStartMs
        });
      }
    }
  }

  const totalFrames = Math.max(0, Math.ceil((maxEndMs * fps) / 1000 - 1e-10));
  return {
    fps,
    tracks,
    overlaps,
    totalFrames,
    totalDurationMs: totalFrames * frameDurationMs
  };
}

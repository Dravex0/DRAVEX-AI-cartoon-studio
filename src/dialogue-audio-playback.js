/**
 * Schedule decoded, user-provided dialogue AudioBuffers on an export AudioContext.
 * Assets are keyed by the stable sceneIndex:lineId pair produced by dialogue-audio.js.
 * No network requests or remote storage are used here.
 */
export function getDialogueAudioAssetKey(cue) {
  if (!cue || !Number.isInteger(cue.sceneIndex) || typeof cue.lineId !== 'string' || !cue.lineId.trim()) return '';
  return cue.sceneIndex + ':' + cue.lineId.trim();
}

/**
 * Schedule local decoded dialogue buffers against the global export timeline.
 * startAt is an AudioContext time (seconds), normally context.currentTime.
 * Each cue is clipped to the shorter of its timeline window and source buffer.
 */
export function scheduleDialogueAudioBuffers({
  context,
  destination,
  schedule,
  audioBuffers,
  characterVolumes = new Map(),
  startAt
} = {}) {
  if (!context || typeof context.createBufferSource !== 'function') {
    throw new TypeError('A Web Audio context with createBufferSource() is required.');
  }
  if (!destination) throw new TypeError('An audio destination is required.');
  if (!Array.isArray(schedule)) throw new TypeError('A dialogue schedule array is required.');
  if (!(audioBuffers instanceof Map)) throw new TypeError('Dialogue audio assets must be supplied as a Map.');
  const baseTime = Number.isFinite(Number(startAt)) ? Math.max(0, Number(startAt)) : Math.max(0, Number(context.currentTime) || 0);
  const sources = [];
  const gains = [];
  const skipped = [];

  for (const cue of schedule) {
    const key = getDialogueAudioAssetKey(cue);
    const buffer = key ? audioBuffers.get(key) : null;
    const startMs = Number(cue?.startMs);
    const endMs = Number(cue?.endMs);
    if (!buffer || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs ||
        !Number.isFinite(Number(buffer.duration)) || Number(buffer.duration) <= 0) {
      skipped.push(key || 'invalid-cue');
      continue;
    }
    const durationSeconds = Math.min((endMs - startMs) / 1000, Number(buffer.duration));
    if (!(durationSeconds > 0)) {
      skipped.push(key);
      continue;
    }
    let source = null;
    let gain = null;
    try {
      source = context.createBufferSource();
      source.buffer = buffer;
      const characterKey = String(cue?.characterId || '').trim().toLowerCase();
      const requestedVolume = characterVolumes instanceof Map ? Number(characterVolumes.get(characterKey)) : NaN;
      const volume = Number.isFinite(requestedVolume) ? Math.max(0, Math.min(1, requestedVolume)) : 1;
      gain = context.createGain();
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(destination);
      const when = baseTime + Math.max(0, startMs) / 1000;
      source.start(when, 0, durationSeconds);
      sources.push(source);
      gains.push(gain);
    } catch {
      // A malformed buffer or a Web Audio scheduling error must not abort other dialogue cues.
      try { source?.stop(); } catch {}
      try { source?.disconnect?.(); } catch {}
      try { gain?.disconnect?.(); } catch {}
      skipped.push(key || 'invalid-cue');
    }
  }

  let stopped = false;
  return {
    scheduledCount: sources.length,
    skipped,
    stop() {
      if (stopped) return;
      stopped = true;
      for (const source of sources) {
        try { source.stop(); } catch {}
        try { source.disconnect?.(); } catch {}
      }
      for (const gain of gains) { try { gain.disconnect?.(); } catch {} }
    }
  };
}

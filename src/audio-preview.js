const clampVolume = value => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 1;
};

function normalizeTracks(tracks) {
  if (!Array.isArray(tracks)) throw new TypeError("voiceTracks must be an array.");
  if (tracks.length > 30) throw new RangeError("Voice preview supports at most 30 dialogue tracks.");
  return tracks.map((track, index) => {
    if (!track || typeof track !== "object" || Array.isArray(track)) throw new TypeError("Voice preview track " + (index + 1) + " must be an object.");
    if (!(typeof Blob !== "undefined" && track.blob instanceof Blob) || track.blob.size === 0) throw new TypeError("Voice preview track " + (index + 1) + " requires a non-empty Blob.");
    const startMs = Number(track.startMs);
    const durationMs = track.durationMs == null ? null : Number(track.durationMs);
    if (!Number.isFinite(startMs) || startMs < 0) throw new RangeError("Voice preview startMs must be non-negative.");
    if (durationMs !== null && (!Number.isFinite(durationMs) || durationMs <= 0)) throw new RangeError("Voice preview durationMs must be positive.");
    return { ...track, startMs, durationMs, cueId: String(track.cueId || "voice-" + (index + 1)) };
  });
}

/** Decode local dialogue and schedule it to speakers against one performance clock. */
export async function createVoicePreviewSession({ voiceTracks = [], voiceVolume = 0.9, AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext, now = () => globalThis.performance?.now?.() ?? Date.now() } = {}) {
  const tracks = normalizeTracks(voiceTracks);
  if (!tracks.length) throw new RangeError("At least one voice track is required.");
  if (typeof AudioContextClass !== "function") throw new Error("Web Audio is not supported in this browser.");
  const context = new AudioContextClass();
  const sources = [];
  let closed = false, started = false, gain = null;
  try {
    gain = context.createGain();
    gain.gain.value = clampVolume(voiceVolume);
    gain.connect(context.destination);
    const decodedTracks = await Promise.all(tracks.map(async track => {
      const buffer = await context.decodeAudioData(await track.blob.arrayBuffer());
      if (!buffer || !Number.isFinite(buffer.duration) || buffer.duration <= 0) throw new Error("Could not decode dialogue audio: " + track.cueId);
      if (track.durationMs !== null) {
        const actualMs = buffer.duration * 1000;
        if (Math.abs(actualMs - track.durationMs) > Math.max(50, track.durationMs * 0.02)) throw new Error("Decoded dialogue duration does not match metadata: " + track.cueId);
      }
      return { ...track, buffer };
    }));
    return {
      decodedTracks,
      async start() {
        if (closed) throw new Error("Voice preview session is closed.");
        if (started) throw new Error("Voice preview session has already started.");
        await context.resume();
        if (closed) throw new Error("Voice preview session is closed.");
        const clockStart = context.currentTime + 0.08;
        const scheduledStartAtMs = now() + Math.max(0, (clockStart - context.currentTime) * 1000);
        for (const track of decodedTracks) {
          const source = context.createBufferSource();
          source.buffer = track.buffer;
          source.connect(gain);
          source.start(clockStart + track.startMs / 1000);
          sources.push(source);
        }
        started = true;
        return scheduledStartAtMs;
      },
      async cleanup() {
        if (closed) return;
        closed = true;
        for (const source of sources.splice(0)) { try { source.stop(); } catch {} }
        try { gain.disconnect(); } catch {}
        if (context.state !== "closed") await context.close();
      }
    };
  } catch (error) {
    for (const source of sources.splice(0)) { try { source.stop(); } catch {} }
    if (gain) try { gain.disconnect(); } catch {}
    if (context.state !== "closed") { try { await context.close(); } catch {} }
    throw error;
  }
}

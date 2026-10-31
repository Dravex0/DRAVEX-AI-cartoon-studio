const clampVolume = value => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 1;
};

function validateVoiceTracks(tracks) {
  if (!Array.isArray(tracks)) throw new TypeError("voiceTracks must be an array.");
  return tracks.map((track, index) => {
    if (!track || typeof track !== "object" || Array.isArray(track)) {
      throw new TypeError(`Voice track ${index + 1} must be an object.`);
    }
    if (!(typeof Blob !== "undefined" && track.blob instanceof Blob) || track.blob.size === 0) {
      throw new TypeError(`Voice track ${index + 1} requires a non-empty audio Blob.`);
    }
    const startMs = Number(track.startMs);
    if (!Number.isFinite(startMs) || startMs < 0) {
      throw new RangeError(`Voice track ${index + 1} startMs must be non-negative.`);
    }
    return { blob: track.blob, startMs, cueId: String(track.cueId || `voice-${index + 1}`) };
  });
}

/**
 * Mixes local music and/or pre-generated dialogue WAVs into a canvas recording.
 * Dialogue is decoded before recording and scheduled against the export clock.
 * Audio is routed only to the recording destination, not back to speakers.
 */
export async function createAudioExportSession({
  videoStream,
  audioElement = null,
  volume = 1,
  voiceTracks = [],
  voiceVolume = 1,
  AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
  MediaStreamClass = globalThis.MediaStream
} = {}) {
  if (!videoStream || typeof videoStream.getTracks !== 'function') {
    throw new TypeError('A video MediaStream is required.');
  }
  if (audioElement && typeof audioElement.play !== 'function') {
    throw new TypeError('audioElement must provide play() when supplied.');
  }
  const tracks = validateVoiceTracks(voiceTracks);
  if (!audioElement && tracks.length === 0) {
    throw new TypeError('At least one music element or voice track is required.');
  }
  if (typeof AudioContextClass !== 'function') {
    throw new Error('Web Audio is not supported by this browser.');
  }
  if (typeof MediaStreamClass !== 'function') {
    throw new Error('MediaStream composition is not supported by this browser.');
  }

  const context = new AudioContextClass();
  let audioTrack = null;
  let closed = false;
  let startPromise = null;
  const voiceSources = [];
  try {
    const destination = context.createMediaStreamDestination();
    if (audioElement) {
      const source = context.createMediaElementSource(audioElement);
      const gain = context.createGain();
      gain.gain.value = clampVolume(volume);
      source.connect(gain);
      gain.connect(destination);
    }

    const voiceGain = context.createGain();
    voiceGain.gain.value = clampVolume(voiceVolume);
    voiceGain.connect(destination);
    const decodedVoices = await Promise.all(tracks.map(async track => {
      const bytes = await track.blob.arrayBuffer();
      const buffer = await context.decodeAudioData(bytes);
      if (!buffer || !Number.isFinite(buffer.duration) || buffer.duration <= 0) {
        throw new Error(`Could not decode dialogue audio: ${track.cueId}`);
      }
      return { ...track, buffer };
    }));

    audioTrack = destination.stream.getAudioTracks()[0];
    if (!audioTrack) throw new Error('Audio recording track could not be created.');

    const stream = new MediaStreamClass([...videoStream.getTracks(), audioTrack]);
    return {
      stream,
      start() {
        if (closed) return Promise.reject(new Error('Audio export session is already closed.'));
        if (startPromise) return startPromise;
        startPromise = (async () => {
          await context.resume();
          if (closed) throw new Error('Audio export session is already closed.');
          if (audioElement) await Promise.resolve().then(() => audioElement.play());
          if (closed) throw new Error('Audio export session is already closed.');
          const clockStart = context.currentTime + 0.08;
          for (const track of decodedVoices) {
            const source = context.createBufferSource();
            source.buffer = track.buffer;
            source.connect(voiceGain);
            source.start(clockStart + track.startMs / 1000);
            voiceSources.push(source);
          }
        })().catch(error => {
          for (const source of voiceSources.splice(0)) {
            try { source.stop(); } catch {}
          }
          if (audioElement) {
            try { audioElement.pause(); } catch {}
            try { audioElement.currentTime = 0; } catch {}
          }
          startPromise = null;
          throw error;
        });
        return startPromise;
      },
      async cleanup() {
        if (closed) return;
        closed = true;
        if (audioElement) {
          try { audioElement.pause(); } catch {}
          try { audioElement.currentTime = 0; } catch {}
        }
        for (const source of voiceSources.splice(0)) {
          try { source.stop(); } catch {}
        }
        try { audioTrack.stop(); } catch {}
        if (context.state !== 'closed') await context.close();
      }
    };
  } catch (error) {
    for (const source of voiceSources.splice(0)) {
      try { source.stop(); } catch {}
    }
    if (audioTrack) {
      try { audioTrack.stop(); } catch {}
    }
    if (audioElement) {
      try { audioElement.pause(); } catch {}
      try { audioElement.currentTime = 0; } catch {}
    }
    if (context.state !== 'closed') {
      try { await context.close(); } catch {}
    }
    throw error;
  }
}

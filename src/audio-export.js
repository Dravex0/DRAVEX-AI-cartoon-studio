const clampVolume = value => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 1;
};

/**
 * Mixes a locally selected audio element into a canvas MediaStream for recording.
 * Audio is routed only to the recording destination, not back to the speakers.
 */
export async function createAudioExportSession({
  videoStream,
  audioElement,
  volume = 1,
  AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
  MediaStreamClass = globalThis.MediaStream
} = {}) {
  if (!videoStream || typeof videoStream.getTracks !== 'function') {
    throw new TypeError('A video MediaStream is required.');
  }
  if (!audioElement || typeof audioElement.play !== 'function') {
    throw new TypeError('An audio element is required.');
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
  try {
    const source = context.createMediaElementSource(audioElement);
    const gain = context.createGain();
    const destination = context.createMediaStreamDestination();
    gain.gain.value = clampVolume(volume);
    source.connect(gain);
    gain.connect(destination);
    audioTrack = destination.stream.getAudioTracks()[0];
    if (!audioTrack) throw new Error('Audio recording track could not be created.');

    const tracks = [...videoStream.getTracks(), audioTrack];
    const stream = new MediaStreamClass(tracks);
    return {
      stream,
      async start() {
        if (closed) throw new Error('Audio export session is already closed.');
        await context.resume();
        await audioElement.play();
      },
      async cleanup() {
        if (closed) return;
        closed = true;
        try { audioElement.pause(); } catch {}
        try { audioElement.currentTime = 0; } catch {}
        try { audioTrack.stop(); } catch {}
        if (context.state !== 'closed') await context.close();
      }
    };
  } catch (error) {
    if (audioTrack) {
      try { audioTrack.stop(); } catch {}
    }
    if (context.state !== 'closed') {
      try { await context.close(); } catch {}
    }
    throw error;
  }
}

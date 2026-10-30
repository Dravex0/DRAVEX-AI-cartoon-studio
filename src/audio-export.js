import { scheduleDialogueAudioBuffers } from './dialogue-audio-playback.js';

const clampVolume = value => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 1;
};

function normalizeAudioTracks({ audioElement, audioTracks, volume }) {
  const requested = Array.isArray(audioTracks) && audioTracks.length
    ? audioTracks
    : audioElement ? [{ audioElement, volume }] : [];

  return requested.map((track, index) => {
    const element = track && typeof track.play === 'function' ? track : track?.audioElement;
    if (!element || typeof element.play !== 'function') {
      throw new TypeError(`Audio track ${index + 1} must contain a playable audioElement.`);
    }
    return {
      audioElement: element,
      volume: clampVolume(track && typeof track.play !== 'function' && track.volume !== undefined ? track.volume : volume)
    };
  });
}

function resetAudioElements(elements) {
  for (const element of elements) {
    try { element.pause(); } catch {}
    try { element.currentTime = 0; } catch {}
  }
}

/**
 * Mixes one or more local audio elements into a canvas MediaStream for recording.
 * Audio is routed only to the recording destination, not back to the speakers.
 * Existing audioElement callers remain supported; audioTracks accepts
 * [{ audioElement, volume }] for separately leveled dialogue and music.
 */
export async function createAudioExportSession({
  videoStream,
  audioElement,
  audioTracks = [],
  volume = 1,
  AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
  MediaStreamClass = globalThis.MediaStream,
  dialogueAudioSchedule = [],
  dialogueAudioBuffers = new Map(),
  dialogueCharacterVolumes = new Map()
} = {}) {
  if (!videoStream || typeof videoStream.getTracks !== 'function') {
    throw new TypeError('A video MediaStream is required.');
  }
  const tracksToMix = normalizeAudioTracks({ audioElement, audioTracks, volume });
  const hasDialogueAudio = Array.isArray(dialogueAudioSchedule) && dialogueAudioSchedule.length > 0 && dialogueAudioBuffers instanceof Map && dialogueAudioBuffers.size > 0;
  if (!tracksToMix.length && !hasDialogueAudio) throw new TypeError('At least one music or dialogue audio track is required.');
  if (typeof AudioContextClass !== 'function') throw new Error('Web Audio is not supported by this browser.');
  if (typeof MediaStreamClass !== 'function') throw new Error('MediaStream composition is not supported by this browser.');

  const context = new AudioContextClass();
  const audioElements = [];
  const outputTracks = [];
  let closed = false;
  let started = false;
  let startTime = null;
  let startPromise = null;
  let dialoguePlayback = null;

  try {
    const destination = context.createMediaStreamDestination();
    for (const track of tracksToMix) {
      const source = context.createMediaElementSource(track.audioElement);
      const gain = context.createGain();
      gain.gain.value = track.volume;
      source.connect(gain);
      gain.connect(destination);
      audioElements.push(track.audioElement);
    }
    outputTracks.push(...destination.stream.getAudioTracks());
    if (!outputTracks.length) throw new Error('Audio recording track could not be created.');
    const stream = new MediaStreamClass([...videoStream.getTracks(), ...outputTracks]);

    return {
      stream,
      start() {
        if (closed) return Promise.reject(new Error('Audio export session is already closed.'));
        if (started) return Promise.resolve(startTime);
        if (startPromise) return startPromise;

        startPromise = (async () => {
          await context.resume();
          if (closed) throw new Error('Audio export session is already closed.');
          startTime = context.currentTime;

          if (Array.isArray(dialogueAudioSchedule) && dialogueAudioSchedule.length) {
            dialoguePlayback = scheduleDialogueAudioBuffers({
              context,
              destination,
              schedule: dialogueAudioSchedule,
              audioBuffers: dialogueAudioBuffers,
              characterVolumes: dialogueCharacterVolumes,
              startAt: startTime
            });
          }

          const results = await Promise.allSettled(audioElements.map(element => element.play()));
          const failed = results.find(result => result.status === 'rejected');
          if (closed || failed) {
            if (dialoguePlayback) {
              try { dialoguePlayback.stop(); } catch {}
              dialoguePlayback = null;
            }
            resetAudioElements(audioElements);
            if (closed) throw new Error('Audio export session is already closed.');
            throw failed.reason;
          }

          started = true;
          return startTime;
        })();

        return startPromise;
      },
      getCurrentTime() { return context.currentTime; },
      async cleanup() {
        if (closed) return;
        closed = true;
        if (dialoguePlayback) {
          try { dialoguePlayback.stop(); } catch {}
          dialoguePlayback = null;
        }
        resetAudioElements(audioElements);
        for (const track of outputTracks) { try { track.stop(); } catch {} }
        if (context.state !== 'closed') await context.close();
      }
    };
  } catch (error) {
    for (const track of outputTracks) { try { track.stop(); } catch {} }
    if (context.state !== 'closed') { try { await context.close(); } catch {} }
    throw error;
  }
}

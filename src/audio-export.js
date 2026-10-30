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
  dialogueAudioBuffers = new Map()
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
      async start() {
        if (closed) throw new Error('Audio export session is already closed.');
        await context.resume();
        if (Array.isArray(dialogueAudioSchedule) && dialogueAudioSchedule.length) {
          dialoguePlayback = scheduleDialogueAudioBuffers({
            context,
            destination,
            schedule: dialogueAudioSchedule,
            audioBuffers: dialogueAudioBuffers,
            startAt: context.currentTime
          });
        }
        await Promise.all(audioElements.map(element => element.play()));
      },
      async cleanup() {
        if (closed) return;
        closed = true;
        if (dialoguePlayback) dialoguePlayback.stop();
        for (const element of audioElements) {
          try { element.pause(); } catch {}
          try { element.currentTime = 0; } catch {}
        }
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

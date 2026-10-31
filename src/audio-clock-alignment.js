/**
 * Return the signed offset from the recording clock to the audio clock.
 * A negative value means audio was scheduled before the recorder began.
 */
export function getAudioTimelineOffsetMs(scheduledStartAtMs, recordingStartAtMs) {
  if (!Number.isFinite(scheduledStartAtMs) || !Number.isFinite(recordingStartAtMs)) {
    throw new RangeError("Audio and recording start timestamps must be finite numbers.");
  }
  return scheduledStartAtMs - recordingStartAtMs;
}

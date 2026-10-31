const cleanSpeaker = value => String(value ?? "").trim().toLocaleLowerCase();

/**
 * Find the currently speaking character's mouth track.
 * Tracks for other speakers are deliberately ignored so simultaneous or
 * adjacent dialogue cannot animate the wrong character.
 * If same-speaker cues overlap, the most recently started active cue wins.
 */
export function findActiveMouthTrack(tracks, {
  sceneIndex,
  elapsedMs,
  characterId
} = {}) {
  if (!Array.isArray(tracks)) throw new TypeError("tracks must be an array.");
  if (!Number.isInteger(sceneIndex) || sceneIndex < 0) {
    throw new RangeError("sceneIndex must be a non-negative integer.");
  }
  if (!Number.isFinite(elapsedMs)) {
    throw new RangeError("elapsedMs must be finite.");
  }
  const speaker = cleanSpeaker(characterId);
  if (!speaker || elapsedMs < 0) return null;

  let active = null;
  for (const track of tracks) {
    if (!track || typeof track !== "object" || track.sceneIndex !== sceneIndex) continue;
    const trackSpeaker = cleanSpeaker(track.characterId ?? track.characterName);
    const startMs = Number(track.startMs);
    const durationMs = Number(track.envelope?.durationMs);
    if (trackSpeaker !== speaker || !Number.isFinite(startMs) || startMs < 0
      || !Number.isFinite(durationMs) || durationMs <= 0) continue;
    if (elapsedMs < startMs || elapsedMs >= startMs + durationMs) continue;
    if (!active || startMs >= active.startMs) active = track;
  }
  return active;
}

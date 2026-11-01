import { sampleAudioMouthEnvelope } from "./audio-mouth-envelope.js";
import { sampleVisemeTimeline } from "./viseme-timeline.js";

const MAX_TRACKS = 2000;
const cleanId = value => String(value ?? "").trim().slice(0, 120);
const isRecord = value => Boolean(value && typeof value === "object" && !Array.isArray(value));

/**
 * Resolve active export dialogue tracks into per-character facial controls.
 * elapsedMs and track.startMs share the export timeline clock.
 * The latest-starting active cue wins if a character has overlapping dialogue.
 */
export function sampleCharacterFacialLipSync(tracks, sceneIndex, elapsedMs) {
  const result = { facialVisemes: {}, facialMouthOpenness: {}, activeCharacterIds: [] };
  if (!Array.isArray(tracks) || !Number.isInteger(sceneIndex) || !Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return result;
  }

  const activeByCharacter = new Map();
  for (const track of tracks.slice(0, MAX_TRACKS)) {
    if (!isRecord(track) || track.sceneIndex !== sceneIndex || !Number.isFinite(track.startMs)
      || !isRecord(track.envelope) || !isRecord(track.visemes)) continue;
    const characterId = cleanId(track.characterId);
    const durationMs = Number(track.envelope.durationMs);
    if (!characterId || !Number.isFinite(durationMs) || durationMs <= 0) continue;
    const localTimeMs = elapsedMs - track.startMs;
    if (localTimeMs < 0 || localTimeMs >= durationMs) continue;
    const previous = activeByCharacter.get(characterId);
    if (!previous || track.startMs >= previous.track.startMs) {
      activeByCharacter.set(characterId, { track, localTimeMs });
    }
  }

  for (const [characterId, active] of activeByCharacter) {
    try {
      result.facialVisemes[characterId] = sampleVisemeTimeline(active.track.visemes, active.localTimeMs);
      result.facialMouthOpenness[characterId] = sampleAudioMouthEnvelope(active.track.envelope, active.localTimeMs);
      result.activeCharacterIds.push(characterId);
    } catch {
      delete result.facialVisemes[characterId];
      delete result.facialMouthOpenness[characterId];
    }
  }
  return result;
}

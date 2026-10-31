import { buildAudioTimeline } from "./audio-timeline.js";

const MAX_DIALOGUE_LINES = 30;
const clean = (value, max = 120) => String(value ?? "").trim().replace(/\s+/gu, " ").slice(0, max);

export function normalizeSpeakerKey(value) {
  return clean(value, 120).toLowerCase();
}

function stableHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Resolve one persistent voice per character.
 * Existing valid assignments never change when later scenes introduce speakers.
 * New speakers receive deterministic assignments, independent of scene line order.
 */
export function assignCharacterVoices({
  speakers,
  availableVoices = [],
  existingAssignments = {},
  fallbackVoiceId = null
} = {}) {
  if (!Array.isArray(speakers)) throw new TypeError("speakers must be an array.");
  if (!existingAssignments || typeof existingAssignments !== "object" || Array.isArray(existingAssignments)) {
    throw new TypeError("existingAssignments must be an object.");
  }
  const voices = [...new Set(availableVoices
    .filter(value => typeof value === "string")
    .map(value => value.trim())
    .filter(Boolean))];
  const validVoiceSet = new Set(voices);
  const assignments = Object.create(null);
  for (const [speaker, voice] of Object.entries(existingAssignments)) {
    const key = normalizeSpeakerKey(speaker);
    const id = typeof voice === "string" ? voice.trim() : "";
    if (key && id && (!voices.length || validVoiceSet.has(id))) assignments[key] = id;
  }

  const speakerKeys = [...new Set(speakers.map(normalizeSpeakerKey).filter(Boolean))].sort();
  const used = new Set(Object.values(assignments));
  for (const key of speakerKeys) {
    if (assignments[key]) continue;
    if (!voices.length) {
      if (typeof fallbackVoiceId === "string" && fallbackVoiceId.trim()) {
        assignments[key] = fallbackVoiceId.trim();
      }
      continue;
    }
    const start = stableHash(key) % voices.length;
    let selected = null;
    for (let offset = 0; offset < voices.length; offset++) {
      const candidate = voices[(start + offset) % voices.length];
      if (!used.has(candidate)) {
        selected = candidate;
        break;
      }
    }
    // If the cast is larger than the voice catalog, reuse deterministically.
    assignments[key] = selected || voices[start];
    used.add(assignments[key]);
  }
  return assignments;
}

/**
 * Place already-generated dialogue WAVs sequentially using their measured
 * durations. No text-length estimate is used for timing.
 */
export function buildSceneVoiceTimeline({
  sceneId,
  dialogue,
  artifacts,
  fps = 24,
  gapMs = 120
} = {}) {
  const id = clean(sceneId, 120);
  if (!id) throw new TypeError("sceneId is required.");
  if (!Array.isArray(dialogue) || !Array.isArray(artifacts)) {
    throw new TypeError("dialogue and artifacts must be arrays.");
  }
  if (dialogue.length === 0 || dialogue.length !== artifacts.length) {
    throw new RangeError("Every dialogue line must have exactly one generated voice artifact.");
  }
  if (dialogue.length > MAX_DIALOGUE_LINES) {
    throw new RangeError("A scene supports at most 30 dialogue lines.");
  }
  if (!Number.isFinite(fps) || fps < 1 || fps > 60) {
    throw new RangeError("fps must be between 1 and 60.");
  }
  if (!Number.isFinite(gapMs) || gapMs < 0 || gapMs > 5000) {
    throw new RangeError("gapMs must be between 0 and 5000.");
  }

  const frameMs = 1000 / fps;
  let cursorMs = 0;
  const cues = dialogue.map((line, index) => {
    const artifact = artifacts[index];
    if (!line || typeof line !== "object" || Array.isArray(line)) {
      throw new TypeError(`Dialogue line ${index + 1} must be an object.`);
    }
    if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
      throw new TypeError(`Voice artifact ${index + 1} must be an object.`);
    }
    const characterName = clean(line.characterId || "Narrator", 120);
    const text = clean(line.text, 2000);
    const audioHash = typeof artifact.audioHash === "string" ? artifact.audioHash.trim().toLowerCase() : "";
    const durationMs = Number(artifact.durationMs);
    if (!text) throw new TypeError(`Dialogue line ${index + 1} has no text.`);
    if (!/^[a-f0-9]{64}$/u.test(audioHash)) {
      throw new TypeError(`Voice artifact ${index + 1} requires a SHA-256 audioHash.`);
    }
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      throw new RangeError(`Voice artifact ${index + 1} requires its measured durationMs.`);
    }
    const startFrame = Math.max(0, Math.ceil(cursorMs / frameMs - 1e-10));
    const cue = {
      cueId: `${id}:dialogue:${index + 1}`,
      characterName,
      characterId: clean(line.characterId || "Narrator", 120),
      text,
      language: clean(line.language || "en", 8),
      voiceId: clean(artifact.voiceId || "", 80) || null,
      audioHash,
      durationMs,
      startFrame
    };
    cursorMs = startFrame * frameMs + durationMs + gapMs;
    return cue;
  });

  const timeline = buildAudioTimeline(cues, fps);
  return { sceneId: id, cues, timeline };
}

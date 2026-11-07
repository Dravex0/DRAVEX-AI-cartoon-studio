import { isUsableVoiceArtifact } from "./voice-artifact-readiness.js";

const VERSION = 1;
const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const VISeme_SHAPES = new Set(["neutral", "open", "wide", "round", "closed", "teeth"]);
const clean = value => String(value ?? "").trim();

function normalizeLine(line, voiceId) {
  return {
    characterId: clean(line?.characterId || "Narrator"),
    text: clean(line?.text),
    voiceId: clean(voiceId)
  };
}

function normalizeVisemeEvents(events, durationMs) {
  if (events == null) return null;
  if (!Array.isArray(events) || events.length > 2000) {
    throw new TypeError("Checkpoint visemeEvents must be an array with at most 2000 entries.");
  }
  let previousStartMs = -1;
  return events.map((event, index) => {
    const shape = clean(event?.shape);
    const startMs = Number(event?.startMs);
    const eventDurationMs = Number(event?.durationMs);
    if (!VISeme_SHAPES.has(shape) || !Number.isFinite(startMs) || !Number.isFinite(eventDurationMs)
      || startMs < 0 || eventDurationMs <= 0 || startMs < previousStartMs
      || startMs >= durationMs + 50 || startMs + eventDurationMs > durationMs + 50) {
      throw new RangeError("Checkpoint contains invalid viseme timing at event " + (index + 1) + ".");
    }
    previousStartMs = startMs;
    return { shape, startMs, durationMs: eventDurationMs };
  });
}

function normalizePhonemeChunks(chunks, durationMs) {
  if (chunks == null) return null;
  if (!Array.isArray(chunks) || chunks.length > 120) {
    throw new TypeError("Checkpoint phonemeChunks must be an array with at most 120 entries.");
  }
  let previousEndMs = 0;
  return chunks.map((chunk, index) => {
    const startMs = Number(chunk?.startMs);
    const endMs = Number(chunk?.endMs);
    const phonemes = clean(chunk?.phonemes).slice(0, 4000);
    const text = clean(chunk?.text).slice(0, 2000);
    if (!phonemes || !Number.isFinite(startMs) || !Number.isFinite(endMs)
      || startMs < previousEndMs - 0.5 || endMs <= startMs || endMs > durationMs + 2) {
      throw new RangeError("Checkpoint contains invalid phoneme chunk timing at chunk " + (index + 1) + ".");
    }
    previousEndMs = endMs;
    return { text, phonemes, startMs, endMs };
  });
}

function normalizeArtifact(artifact, fallbackVoiceId) {
  const audioHash = clean(artifact?.audioHash).toLowerCase();
  const durationMs = Number(artifact?.durationMs);
  if (!HASH_PATTERN.test(audioHash) || !Number.isFinite(durationMs) || durationMs <= 0) {
    throw new TypeError("Checkpoint artifacts require a SHA-256 hash and measured duration.");
  }
  const visemeEvents = normalizeVisemeEvents(artifact.visemeEvents, durationMs);
  const phonemeChunks = normalizePhonemeChunks(artifact.phonemeChunks, durationMs);
  return {
    audioHash,
    durationMs,
    voiceId: clean(artifact.voiceId || fallbackVoiceId) || null,
    ...(visemeEvents ? { visemeEvents } : {}),
    ...(phonemeChunks ? { phonemeChunks } : {})
  };
}

function tryNormalizeArtifact(artifact, fallbackVoiceId) {
  try {
    return normalizeArtifact(artifact, fallbackVoiceId);
  } catch {
    return null;
  }
}

export function createVoiceGenerationCheckpoint({
  sceneId, locale, engine, modelId, dialogue, voiceIds, artifacts
} = {}) {
  if (!Array.isArray(dialogue) || !Array.isArray(artifacts) || dialogue.length !== artifacts.length) {
    throw new TypeError("Dialogue and artifacts must have matching arrays.");
  }
  if (!Array.isArray(voiceIds) || voiceIds.length !== dialogue.length) {
    throw new TypeError("Every dialogue line requires a resolved voice ID slot.");
  }
  return {
    version: VERSION,
    sceneId: clean(sceneId),
    locale: clean(locale).toLowerCase(),
    engine: clean(engine),
    modelId: clean(modelId),
    lines: dialogue.map((line, index) => {
      const normalized = normalizeLine(line, voiceIds[index]);
      if (!artifacts[index]) return { ...normalized, artifact: null };
      return {
        ...normalized,
        artifact: normalizeArtifact(artifacts[index], voiceIds[index])
      };
    })
  };
}

/**
 * Restore only artifacts that match the exact scene, language, model, speaker,
 * dialogue text and voice assignment, and whose actual verified WAV still
 * exists in local storage. Corrupt or stale lines are returned as null.
 */
export async function restoreVoiceGenerationCheckpoint({
  checkpoint, sceneId, locale, engine, modelId, dialogue, voiceIds, storage
} = {}) {
  if (!Array.isArray(dialogue) || !Array.isArray(voiceIds) || dialogue.length !== voiceIds.length) {
    throw new TypeError("Dialogue and resolved voice IDs must have matching arrays.");
  }
  if (!storage || typeof storage.get !== "function") {
    throw new TypeError("Voice audio storage with get(hash) is required.");
  }
  const empty = () => Array(dialogue.length).fill(null);
  if (!checkpoint || checkpoint.version !== VERSION
    || checkpoint.sceneId !== clean(sceneId)
    || checkpoint.locale !== clean(locale).toLowerCase()
    || checkpoint.engine !== clean(engine)
    || checkpoint.modelId !== clean(modelId)
    || !Array.isArray(checkpoint.lines)
    || checkpoint.lines.length !== dialogue.length) return empty();

  const restored = empty();
  for (let index = 0; index < dialogue.length; index += 1) {
    const line = checkpoint.lines[index];
    const expected = normalizeLine(dialogue[index], voiceIds[index]);
    if (!line || line.characterId !== expected.characterId
      || line.text !== expected.text || line.voiceId !== expected.voiceId) continue;
    const artifact = tryNormalizeArtifact(line.artifact, expected.voiceId);
    if (!artifact) continue;
    const record = await storage.get(artifact.audioHash);
    if (!isUsableVoiceArtifact(record, artifact.audioHash, artifact)) continue;
    restored[index] = artifact;
  }
  return restored;
}

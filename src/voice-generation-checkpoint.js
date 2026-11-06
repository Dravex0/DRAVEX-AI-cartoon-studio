const VERSION = 1;
const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const clean = value => String(value ?? "").trim();

function normalizeLine(line, voiceId) {
  return {
    characterId: clean(line?.characterId || "Narrator"),
    text: clean(line?.text),
    voiceId: clean(voiceId)
  };
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
      const artifact = artifacts[index];
      const normalized = normalizeLine(line, voiceIds[index]);
      if (!artifact) return { ...normalized, artifact: null };
      const audioHash = clean(artifact.audioHash).toLowerCase();
      const durationMs = Number(artifact.durationMs);
      if (!HASH_PATTERN.test(audioHash) || !Number.isFinite(durationMs) || durationMs <= 0) {
        throw new TypeError("Checkpoint artifacts require a SHA-256 hash and measured duration.");
      }
      return {
        ...normalized,
        artifact: {
          audioHash,
          durationMs,
          voiceId: clean(artifact.voiceId || voiceIds[index]) || null,
          ...(Array.isArray(artifact.visemeEvents) ? { visemeEvents: artifact.visemeEvents } : {}),
          ...(Array.isArray(artifact.phonemeChunks) ? { phonemeChunks: artifact.phonemeChunks } : {})
        }
      };
    })
  };
}

/**
 * Restore only artifacts that match the exact scene, language, model, speaker,
 * dialogue text and voice assignment, and whose actual non-empty WAV still
 * exists in local storage. Invalid or stale lines are returned as null.
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
    const artifact = line.artifact;
    const audioHash = clean(artifact?.audioHash).toLowerCase();
    const durationMs = Number(artifact?.durationMs);
    if (!HASH_PATTERN.test(audioHash) || !Number.isFinite(durationMs) || durationMs <= 0) continue;
    const record = await storage.get(audioHash);
    if (!record?.blob || Number(record.blob.size) <= 0) continue;
    restored[index] = {
      audioHash,
      durationMs,
      voiceId: clean(artifact.voiceId || expected.voiceId) || null,
      ...(Array.isArray(artifact.visemeEvents) ? { visemeEvents: artifact.visemeEvents } : {}),
      ...(Array.isArray(artifact.phonemeChunks) ? { phonemeChunks: artifact.phonemeChunks } : {})
    };
  }
  return restored;
}

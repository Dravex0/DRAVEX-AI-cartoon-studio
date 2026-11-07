const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const WAV_MIME_TYPES = new Set(["audio/wav", "audio/x-wav", "audio/wave", "application/octet-stream"]);

function durationMatches(actualValue, expectedValue) {
  const actual = Number(actualValue);
  const expected = Number(expectedValue);
  if (!Number.isFinite(actual) || actual <= 0 || !Number.isFinite(expected) || expected <= 0) return false;
  return Math.abs(actual - expected) <= Math.max(50, expected * 0.02);
}

export function isUsableVoiceArtifact(record, hash, cue) {
  const blob = record?.blob;
  if (!blob || !Number.isFinite(Number(blob.size)) || Number(blob.size) <= 0) return false;

  const storedHash = String(record.audioHash || "").trim().toLowerCase();
  if (storedHash && storedHash !== hash.toLowerCase()) return false;
  if (record.byteSize != null && Number(record.byteSize) !== Number(blob.size)) return false;

  const mimeType = String(record.mimeType || blob.type || "").toLowerCase().split(";")[0].trim();
  if (!mimeType || !WAV_MIME_TYPES.has(mimeType)) return false;

  if (!durationMatches(record.durationMs, cue?.durationMs)) return false;
  return true;
}

/**
 * Check the actual local IndexedDB artifacts behind populated voice cues.
 * Draft metadata can outlive browser storage eviction or become inconsistent
 * with its stored Blob, so hashes alone are never proof of export readiness.
 */
export async function findScenesWithMissingVoiceAudio(scenes, storage) {
  if (!Array.isArray(scenes)) return [];
  if (!storage || typeof storage.get !== "function") {
    throw new TypeError("Voice audio storage with get(hash) is required.");
  }
  const missing = [];
  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index];
    const dialogue = Array.isArray(scene?.dialogue) ? scene.dialogue : [];
    const cues = Array.isArray(scene?.voiceCues) ? scene.voiceCues : [];
    if (!dialogue.length || !cues.length) continue;
    let unavailable = cues.length !== dialogue.length;
    for (const cue of cues) {
      if (unavailable) break;
      const hash = String(cue?.audioHash || "").trim();
      if (!HASH_PATTERN.test(hash)) {
        unavailable = true;
        break;
      }
      const record = await storage.get(hash);
      if (!isUsableVoiceArtifact(record, hash, cue)) unavailable = true;
    }
    if (unavailable) {
      const sceneId = String(scene?.id || "").trim();
      if (sceneId) missing.push({ sceneId, index });
    }
  }
  return missing;
}

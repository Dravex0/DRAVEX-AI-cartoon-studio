const HASH_PATTERN = /^[a-f0-9]{64}$/i;

/**
 * Check the actual local IndexedDB artifacts behind populated voice cues.
 * Draft metadata can outlive browser storage eviction, so hashes alone must
 * never be treated as proof that a film can be exported with dialogue.
 */
export async function findScenesWithMissingVoiceAudio(scenes, storage) {
  if (!Array.isArray(scenes)) return [];
  if (!storage || typeof storage.get !== 'function') {
    throw new TypeError('Voice audio storage with get(hash) is required.');
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
      const hash = String(cue?.audioHash || '').trim();
      if (!HASH_PATTERN.test(hash)) {
        unavailable = true;
        break;
      }
      const record = await storage.get(hash);
      if (!record?.blob || Number(record.blob.size) <= 0) unavailable = true;
    }
    if (unavailable) {
      const sceneId = String(scene?.id || '').trim();
      if (sceneId) missing.push({ sceneId, index });
    }
  }
  return missing;
}

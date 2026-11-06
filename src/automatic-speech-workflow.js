const hashPattern = /^[a-f0-9]{64}$/i;

/**
 * Check the actual local IndexedDB artifacts behind otherwise populated voice
 * cues. Draft metadata can outlive browser storage eviction, so hashes alone
 * must never be treated as proof that a film can be exported with dialogue.
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
      if (!hashPattern.test(hash)) {
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

const clean = value => String(value ?? '').trim();
const hashPattern = /^[a-f0-9]{64}$/i;

function hasDialogue(scene) {
  return Array.isArray(scene?.dialogue) && scene.dialogue.some(line =>
    clean(line?.text) && clean(line?.characterId)
  );
}

function voiceArtifactsMatchDialogue(scene, language = null) {
  const dialogue = Array.isArray(scene?.dialogue) ? scene.dialogue : [];
  const cues = Array.isArray(scene?.voiceCues) ? scene.voiceCues : [];
  if (!dialogue.length || cues.length !== dialogue.length) return false;
  return dialogue.every((line, index) => {
    const cue = cues[index];
    return clean(cue?.text) === clean(line?.text)
      && clean(cue?.characterId) === clean(line?.characterId)
      && (!language || clean(cue?.language) === clean(language))
      && hashPattern.test(clean(cue?.audioHash))
      && Number.isFinite(Number(cue?.durationMs))
      && Number(cue.durationMs) > 0;
  });
}

/**
 * Detect speech work only when the user's prompt explicitly requests it.
 * Existing dialogue and matching generated voice artifacts are preserved.
 */
export function resolveAutomaticSpeechTasks({ request = '', scenes = [], language = null } = {}) {
  const source = clean(request).toLocaleLowerCase();
  const speechSource = source.replace(/\bspeech\s+bubbles?\b/giu, '');
  const dialogueRequested = /dialogue|spoken|speech|voice.?over|narrat|script|talking|speak|реплик|диалог|голос|озвуч|говор|разговор|реч|диктор|закадр/iu.test(speechSource);
  const voiceRequested = /voice|spoken|speech|voice.?over|narrat|talking|speak|озвуч|голос|реч|говор|диктор|закадр|звук/iu.test(speechSource);
  const list = Array.isArray(scenes) ? scenes : [];
  const scenesMissingDialogue = dialogueRequested
    ? list.map((scene, index) => ({ scene, index })).filter(item => !hasDialogue(item.scene))
    : [];
  const scenesMissingVoice = voiceRequested
    ? list.map((scene, index) => ({ scene, index }))
      .filter(item => hasDialogue(item.scene) && !voiceArtifactsMatchDialogue(item.scene, language))
      .map(item => ({ sceneId: clean(item.scene?.id), index: item.index }))
      .filter(item => item.sceneId)
    : [];
  return {
    dialogueRequested,
    voiceRequested,
    scenesMissingDialogue,
    scenesMissingVoice
  };
}

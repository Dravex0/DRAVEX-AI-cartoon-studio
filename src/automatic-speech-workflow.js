const clean = value => String(value ?? '').trim();
const hashPattern = /^[a-f0-9]{64}$/i;

function hasDialogue(scene) {
  return Array.isArray(scene?.dialogue) && scene.dialogue.some(line =>
    clean(line?.text) && clean(line?.characterId)
  );
}

function voiceArtifactsMatchDialogue(scene) {
  const dialogue = Array.isArray(scene?.dialogue) ? scene.dialogue : [];
  const cues = Array.isArray(scene?.voiceCues) ? scene.voiceCues : [];
  if (!dialogue.length || cues.length !== dialogue.length) return false;
  return dialogue.every((line, index) => {
    const cue = cues[index];
    return clean(cue?.text) === clean(line?.text)
      && clean(cue?.characterId) === clean(line?.characterId)
      && hashPattern.test(clean(cue?.audioHash))
      && Number.isFinite(Number(cue?.durationMs))
      && Number(cue.durationMs) > 0;
  });
}

/**
 * Detect speech work only when the user's prompt explicitly requests it.
 * Existing dialogue and matching generated voice artifacts are preserved.
 */
export function resolveAutomaticSpeechTasks({ request = '', scenes = [] } = {}) {
  const source = clean(request).toLocaleLowerCase();
  const speechSource = source.replace(/\bspeech\\s+bubbles?\b/giu, '');
  const dialogueRequested = /dialogue|spoken|speech|voice.?over|narrat|script|talking|speak|реплик|диалог|голос|озвуч|говор|разговор|реч|диктор|закадр/iu.test(speechSource);
  const voiceRequested = /voice|spoken|speech|voice.?over|narrat|talking|speak|озвуч|голос|реч|говор|диктор|закадр|звук/iu.test(speechSource);
  const list = Array.isArray(scenes) ? scenes : [];
  const scenesMissingDialogue = dialogueRequested
    ? list.map((scene, index) => ({ scene, index })).filter(item => !hasDialogue(item.scene))
    : [];
  const scenesMissingVoice = voiceRequested
    ? list.map((scene, index) => ({ scene, index }))
      .filter(item => hasDialogue(item.scene) && !voiceArtifactsMatchDialogue(item.scene))
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

/**
 * Parse a local dialogue recording filename.
 * Expected format: scene1_dialogue_1.mp3 (1-based scene number).
 */
export function parseDialogueAudioFilename(filename) {
  if (typeof filename !== 'string') return null;
  const match = /^scene([1-9]\d*)_(dialogue_[1-9]\d*)\.[a-z0-9]{2,8}$/i.exec(filename.trim());
  if (!match) return null;
  const sceneNumber = Number(match[1]);
  if (!Number.isSafeInteger(sceneNumber) || sceneNumber < 1) return null;
  return {
    sceneIndex: sceneNumber - 1,
    lineId: match[2].toLowerCase()
  };
}

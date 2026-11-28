/**
 * Synchronize the editable scene-dialogue field with storyboard metadata.
 * Any text change invalidates previously generated voice cues so an export
 * cannot silently pair new dialogue text with old audio. Clearing the editor
 * also removes orphaned voice artifacts.
 */
export function syncSceneDialogueDraft(scene, dialogueLines) {
  if (!scene || typeof scene !== "object" || Array.isArray(scene)) {
    throw new TypeError("A scene object is required.");
  }
  if (!Array.isArray(dialogueLines)) {
    throw new TypeError("dialogueLines must be an array.");
  }

  const previousLines = Array.isArray(scene.dialogue) ? scene.dialogue : [];
  const dialogueChanged = JSON.stringify(previousLines) !== JSON.stringify(dialogueLines);
  const hasVoiceCues = Array.isArray(scene.voiceCues) && scene.voiceCues.length > 0;
  const hasVoiceTimeline = scene.voiceTimeline != null;
  const orphanedVoice = dialogueLines.length === 0 && (hasVoiceCues || hasVoiceTimeline);

  if (!dialogueChanged && !orphanedVoice) return scene;

  return {
    ...scene,
    dialogue: dialogueLines,
    voiceCues: [],
    voiceTimeline: null
  };
}

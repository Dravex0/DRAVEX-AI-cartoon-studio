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


/** Stable UI assignment key; unlike sceneIndex, sceneId survives scene reordering. */
export function getDialogueAudioAssignmentKey(sceneId, lineId) {
  if (typeof sceneId !== 'string' || !sceneId.trim() ||
      typeof lineId !== 'string' || !lineId.trim()) return '';
  return sceneId.trim() + ':' + lineId.trim();
}

/**
 * Translate stable scene-ID assignments to the current export schedule's
 * positional asset keys. Deleted scenes and removed lines are naturally ignored.
 */
export function mapDialogueAudioAssignmentsToSchedule(assignments, scenes, schedule) {
  const result = new Map();
  if (!(assignments instanceof Map) || !Array.isArray(scenes) || !Array.isArray(schedule)) return result;
  for (const cue of schedule) {
    const scene = scenes[cue?.sceneIndex];
    const stableKey = getDialogueAudioAssignmentKey(scene?.id, cue?.lineId);
    const exportKey = Number.isInteger(cue?.sceneIndex) && typeof cue?.lineId === 'string'
      ? cue.sceneIndex + ':' + cue.lineId : '';
    if (stableKey && exportKey && assignments.has(stableKey)) result.set(exportKey, assignments.get(stableKey));
  }
  return result;
}


/** Remove file references for scenes/lines that no longer exist in the storyboard. */
export function pruneDialogueAudioAssignments(assignments, scenes) {
  if (!(assignments instanceof Map)) return new Map();
  const validKeys = new Set();
  for (const scene of Array.isArray(scenes) ? scenes : []) {
    for (const [index, line] of (Array.isArray(scene?.dialogueTimeline) ? scene.dialogueTimeline : []).entries()) {
      const lineId = typeof line?.id === 'string' && line.id.trim() ? line.id.trim() : 'dialogue_' + (index + 1);
      const key = getDialogueAudioAssignmentKey(scene?.id, lineId);
      if (key) validKeys.add(key);
    }
  }
  const retained = new Map();
  for (const [key, file] of assignments) if (validKeys.has(key)) retained.set(key, file);
  return retained;
}

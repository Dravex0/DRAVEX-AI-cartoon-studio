const MAX_DIALOGUE_LINES_PER_SCENE = 20;

/**
 * Convert scene-local dialogue timings into offsets on the complete export timeline.
 * Audio assets can be attached by the stable (sceneIndex, lineId) pair.
 */
export function buildDialogueAudioSchedule(scenes, exportTimeline) {
  const segments = Array.isArray(exportTimeline?.segments) ? exportTimeline.segments : [];
  const source = Array.isArray(scenes) ? scenes : [];
  const schedule = [];

  for (const segment of segments) {
    const scene = source[segment.sceneIndex];
    if (!scene || !Number.isFinite(Number(segment.startMs))) continue;
    const durationMs = Math.max(0, Number(segment.durationMs) || 0);
    const lines = Array.isArray(scene.dialogueTimeline)
      ? scene.dialogueTimeline.slice(0, MAX_DIALOGUE_LINES_PER_SCENE)
      : [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const start = Number(line?.startSeconds);
      const end = Number(line?.endSeconds);
      const lineText = typeof line?.text === 'string' ? line.text.trim() : '';
      const characterId = typeof line?.characterId === 'string' ? line.characterId.trim() : '';
      if (!lineText || !characterId || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

      const localStartMs = Math.max(0, Math.min(durationMs, Math.round(start * 1000)));
      const localEndMs = Math.max(0, Math.min(durationMs, Math.round(end * 1000)));
      if (localEndMs <= localStartMs) continue;

      schedule.push({
        sceneIndex: segment.sceneIndex,
        lineId: typeof line.id === 'string' && line.id.trim() ? line.id.trim() : `dialogue_${index + 1}`,
        characterId,
        text: lineText,
        startMs: Math.round(Number(segment.startMs)) + localStartMs,
        endMs: Math.round(Number(segment.startMs)) + localEndMs
      });
    }
  }

  return schedule.sort((a, b) => a.startMs - b.startMs || a.sceneIndex - b.sceneIndex);
}

/** Find the dialogue cue active at a global export time. */
export function getActiveDialogueAudioCue(schedule, elapsedMs) {
  const time = Number.isFinite(Number(elapsedMs)) ? Math.max(0, Number(elapsedMs)) : 0;
  if (!Array.isArray(schedule)) return null;
  return schedule.find(cue => time >= cue.startMs && time < cue.endMs) || null;
}

/** Collect all distinct attributed speakers across the storyboard in first-seen order. */
export function getDialogueSpeakers(scenes) {
  const source = Array.isArray(scenes) ? scenes : [];
  const seen = new Set();
  const speakers = [];
  for (const scene of source) {
    const lines = Array.isArray(scene?.dialogueTimeline) ? scene.dialogueTimeline.slice(0, MAX_DIALOGUE_LINES_PER_SCENE) : [];
    for (const line of lines) {
      const name = typeof line?.characterId === 'string' ? line.characterId.trim().slice(0, 120) : '';
      const key = name.toLocaleLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      speakers.push(name);
    }
  }
  return speakers;
}

import { normalizeScenes, SCENE_DURATION_MIN, SCENE_DURATION_MAX } from './scene-model.js';

const STOP_WORDS = new Set(['the','and','for','with','from','into','that','this','then','they','their','while','after','before','over','under','his','her','its','are','was','were','onto','through','very','same','shot','scene']);
const VAGUE_ACTION = /^(?:looks? around|stands? there|is standing|waits?|nothing happens|looks? at (?:the )?(?:camera|viewer)|(?:персонаж )?(?:стоит|смотрит вокруг|жд[её]т)\.?)[.!?]?$/i;

function tokens(value) {
  return String(value ?? '').toLowerCase().normalize('NFKC')
    .match(/[\p{L}\p{N}]+/gu)?.filter((word) => word.length > 2 && !STOP_WORDS.has(word)) ?? [];
}
function similarity(left, right) {
  const a = new Set(tokens(left)); const b = new Set(tokens(right));
  if (!a.size || !b.size) return 0;
  let overlap = 0; for (const token of a) if (b.has(token)) overlap++;
  return overlap / (a.size + b.size - overlap);
}
function cameraShotType(camera) {
  const value = String(camera ?? '').toLowerCase();
  if (/extreme close|extreme close-up|\becu\b|экстремальн[а-яёіїєґ]*\s+крупн[а-яёіїєґ]*\s+план|сверхкрупн[а-яёіїєґ]*\s+план/.test(value)) return 'extreme-close-up';
  if (/\bmacro\b|\bclose[- ]?up\b|\bclose shot\b|крупн[а-яёіїєґ]*\s+план|перв[а-яёіїєґ]*\s+план|primer plano/.test(value)) return 'close-up';
  if (/\bwide\b|establishing shot|общ[а-яёіїєґ]*\s+план|загальн[а-яёіїєґ]*\s+план|plano general/.test(value)) return 'wide';
  if (/\bmedium\b|\bmid shot\b|средн[а-яёіїєґ]*\s+план|середн[а-яёіїєґ]*\s+план|plano medio/.test(value)) return 'medium';
  if (/over[- ]the[- ]shoulder|over-shoulder|\bots\b|через плечо|через плече/.test(value)) return 'over-shoulder';
  if (/\bpoint of view\b|\bpov\b|от первого лица|від першої особи/.test(value)) return 'point-of-view';
  if (/\baerial\b|\bdrone shot\b|с высоты|з висоти/.test(value)) return 'aerial';
  return '';
}
function issue(severity, code, sceneId, message, otherSceneId) {
  return { severity, code, sceneId, ...(otherSceneId ? { otherSceneId } : {}), message };
}

/** Deterministic text checks only; this does not analyze frames or call a model. */
export function validateStoryScenes(rawScenes) {
  const scenes = normalizeScenes(rawScenes);
  const issues = [];
  if (!scenes.length) return {
    sceneCount: 0, totalDurationSeconds: 0, errorCount: 1, warningCount: 0,
    issues: [issue('error', 'no-scenes', '', 'Add at least one scene before continuing.')], ok: false
  };
  const seenIds = new Map();
  scenes.forEach((scene, index) => {
    if (seenIds.has(scene.id)) {
      const firstIndex = seenIds.get(scene.id);
      issues.push(issue('error', 'duplicate-scene-id', scene.id, `Scene ID is duplicated; it first appeared at position ${firstIndex + 1}.`, scenes[firstIndex].id));
    } else seenIds.set(scene.id, index);
    const rawScene = rawScenes[index] && typeof rawScenes[index] === 'object' ? rawScenes[index] : {};
    if (!scene.prompt && !scene.visibleAction) issues.push(issue('error', 'missing-visual-direction', scene.id, 'Add a visual prompt or a visible action.'));
    if (!scene.visibleAction) issues.push(issue('warning', 'action-not-structured', scene.id, 'Visible action is not separated from the prompt yet.'));
    else if (VAGUE_ACTION.test(scene.visibleAction.trim())) issues.push(issue('warning', 'vague-action', scene.id, 'Action is vague; describe a visible change, movement, or outcome.'));
    let duration = NaN;
    try { duration = Number(rawScene.durationSeconds ?? rawScene.duration); } catch {}
    if (!Number.isFinite(duration) || duration < SCENE_DURATION_MIN || duration > SCENE_DURATION_MAX) {
      issues.push(issue('warning', 'duration-normalized', scene.id, `Duration must be ${SCENE_DURATION_MIN}–${SCENE_DURATION_MAX} seconds; fallback preview duration is ${scene.durationSeconds}s.`));
    }
    if (!scene.startState || !scene.endState) issues.push(issue('info', 'continuity-state-missing', scene.id, 'Add start/end state notes to make continuity checks more specific.'));
    for (const line of scene.dialogue) {
      if (!line.characterId) continue;
      if (!scene.characters.length) issues.push(issue('warning', 'dialogue-character-list-missing', scene.id, `Dialogue names speaker "${line.characterId}", but this scene has no character list to validate against.`));
      else if (!scene.characters.includes(line.characterId)) issues.push(issue('warning', 'dialogue-speaker-not-in-scene', scene.id, `Dialogue speaker "${line.characterId}" is not listed among this scene's characters.`));
    }
    if (index > 0) {
      const previous = scenes[index - 1];
      const promptScore = similarity(scene.prompt, previous.prompt);
      const actionScore = similarity(scene.visibleAction, previous.visibleAction);
      const fallbackScore = similarity(scene.prompt || scene.visibleAction, previous.prompt || previous.visibleAction);
      const score = Math.max(promptScore, actionScore, fallbackScore);
      if (score >= 0.78) issues.push(issue('warning', 'adjacent-repeat', scene.id, `This scene is very similar to the previous scene (${Math.round(score * 100)}% token overlap).`, previous.id));
      const currentShot = cameraShotType(scene.camera);
      const previousShot = cameraShotType(previous.camera);
      if (currentShot && currentShot === previousShot) {
        issues.push(issue('info', 'camera-shot-repeat', scene.id, `The ${currentShot.replaceAll('-', ' ')} framing repeats the previous scene; consider changing shot size or angle.`, previous.id));
      }
    }
    for (let earlier = 0; earlier < index - 1; earlier++) {
      const prior = scenes[earlier];
      // Check prompt and action separately so changed prose cannot hide a reused action.
      const promptScore = similarity(scene.prompt, prior.prompt);
      const actionScore = similarity(scene.visibleAction, prior.visibleAction);
      const fallbackScore = similarity(scene.prompt || scene.visibleAction, prior.prompt || prior.visibleAction);
      const score = Math.max(promptScore, actionScore, fallbackScore);
      if (score >= 0.9) {
        issues.push(issue('info', 'repeated-content', scene.id, `Similar content also appears in scene ${earlier + 1}.`, prior.id));
        break;
      }
    }
  });
  const errorCount = issues.filter((entry) => entry.severity === 'error').length;
  const warningCount = issues.filter((entry) => entry.severity === 'warning').length;
  return {
    sceneCount: scenes.length,
    totalDurationSeconds: Number(scenes.reduce((total, scene) => total + scene.durationSeconds, 0).toFixed(2)),
    errorCount, warningCount, issues, ok: errorCount === 0
  };
}

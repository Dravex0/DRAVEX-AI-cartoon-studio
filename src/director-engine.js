import { normalizeScene } from './scene-model.js';

/** Cinematic shot scales used by the deterministic storyboard director. */
export const SHOT_SCALES = Object.freeze({
  EXTREME_WIDE: 'ELS',
  WIDE: 'WS',
  MEDIUM: 'MS',
  CLOSE_UP: 'CU',
  EXTREME_CU: 'ECU',
});

const SCALE_TRANSITIONS = Object.freeze({
  [SHOT_SCALES.EXTREME_WIDE]: [SHOT_SCALES.WIDE, SHOT_SCALES.MEDIUM],
  [SHOT_SCALES.WIDE]: [SHOT_SCALES.MEDIUM, SHOT_SCALES.CLOSE_UP],
  [SHOT_SCALES.MEDIUM]: [SHOT_SCALES.CLOSE_UP, SHOT_SCALES.WIDE, SHOT_SCALES.EXTREME_CU],
  [SHOT_SCALES.CLOSE_UP]: [SHOT_SCALES.MEDIUM, SHOT_SCALES.EXTREME_WIDE],
  [SHOT_SCALES.EXTREME_CU]: [SHOT_SCALES.CLOSE_UP, SHOT_SCALES.MEDIUM],
});

const CAMERA_TRANSFORMS = Object.freeze({
  [SHOT_SCALES.EXTREME_WIDE]: Object.freeze({ zoom: 0.85, offsetY: -20 }),
  [SHOT_SCALES.WIDE]: Object.freeze({ zoom: 1, offsetY: 0 }),
  [SHOT_SCALES.MEDIUM]: Object.freeze({ zoom: 1.25, offsetY: 25 }),
  [SHOT_SCALES.CLOSE_UP]: Object.freeze({ zoom: 1.6, offsetY: 55 }),
  [SHOT_SCALES.EXTREME_CU]: Object.freeze({ zoom: 2.1, offsetY: 75 }),
});

function containsAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

/**
 * Text-only directing heuristic. It does not inspect images or infer actual poses.
 * Accepts the canonical scene model and legacy action/motion fields.
 */
export function calculateCinematicShot(sceneData = {}, previousScale = null) {
  const scene = normalizeScene(sceneData);
  const text = [
    scene.title, scene.purpose, scene.visibleAction, scene.prompt,
    scene.location, scene.camera, scene.effects,
  ].join(' ').toLocaleLowerCase();
  const beatIndex = Number.isInteger(sceneData.beatIndex) ? sceneData.beatIndex : 0;

  let targetScale = SHOT_SCALES.MEDIUM;
  let emotionalWeight = 0.5;
  let focusTarget = 'actor';

  if (containsAny(text, [
    'вспых', 'сия', 'взрыв', 'огн', 'маг', 'рун', 'артефакт', 'плам', 'светится',
    'burst', 'magic', 'flash', 'glow', 'rune', 'artifact', 'flame',
  ])) {
    targetScale = SHOT_SCALES.EXTREME_CU;
    emotionalWeight = 0.95;
    focusTarget = 'prop';
  } else if (containsAny(text, [
    'испуг', 'страх', 'замер', 'пораж', 'улыб', 'слез', 'радост', 'глаз', 'лиц',
    'afraid', 'fear', 'shocked', 'smile', 'tears', 'joy', 'eyes', 'face', 'reaction',
  ])) {
    targetScale = SHOT_SCALES.CLOSE_UP;
    emotionalWeight = 0.8;
    focusTarget = 'actor_face';
  } else if (
    beatIndex === 0 ||
    containsAny(text, ['лес', 'замок', 'собор', 'город', 'окрестност', 'пейзаж', 'окружен', 'forest', 'landscape', 'city', 'castle', 'cathedral', 'environment'])
  ) {
    targetScale = SHOT_SCALES.WIDE;
    emotionalWeight = 0.3;
    focusTarget = 'environment';
  }

  // Unknown previous scales are ignored instead of crashing or forcing a random scale.
  const allowed = SCALE_TRANSITIONS[previousScale];
  if (previousScale && allowed && !allowed.includes(targetScale) && targetScale !== previousScale) {
    targetScale = allowed[0];
  }

  // Keep focus consistent with the final scale after transition rules have run.
  if (targetScale === SHOT_SCALES.EXTREME_WIDE || targetScale === SHOT_SCALES.WIDE) {
    if (focusTarget !== 'prop') focusTarget = 'environment';
  } else if (targetScale === SHOT_SCALES.CLOSE_UP) {
    focusTarget = 'actor_face';
  } else if (targetScale === SHOT_SCALES.EXTREME_CU && focusTarget !== 'prop') {
    focusTarget = 'detail';
  }

  return {
    shotScale: targetScale,
    focusTarget,
    emotionalWeight,
    cameraTransform: { ...CAMERA_TRANSFORMS[targetScale] },
  };
}

/** Returns the action phase and normalized phase weight for progress t in [0, 1]. */
export function calculateActionPhase(t, actionType = 'interaction') {
  const numericT = Number(t);
  const clampedT = Number.isFinite(numericT) ? Math.max(0, Math.min(1, numericT)) : 0;
  const timings = actionType === 'climax'
    ? { prep: 0.65, peak: 0.85 }
    : { prep: 0.30, peak: 0.70 };

  if (clampedT < timings.prep) {
    const localProgress = clampedT / timings.prep;
    return { phase: 'anticipation', phaseWeight: localProgress * localProgress };
  }
  if (clampedT < timings.peak) {
    const localProgress = (clampedT - timings.prep) / (timings.peak - timings.prep);
    return { phase: 'execution', phaseWeight: 1 - Math.pow(1 - localProgress, 3) };
  }
  const localProgress = (clampedT - timings.peak) / (1 - timings.peak);
  return { phase: 'recovery', phaseWeight: 1 - Math.sin(localProgress * Math.PI * 0.5) };
}

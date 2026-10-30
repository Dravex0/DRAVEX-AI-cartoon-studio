const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = value => value * value * (3 - 2 * value);

const pose = (values = {}) => ({
  x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1,
  headRotation: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0,
  expression: 'neutral',
  ...values
});

const clip = (loop, frames) => Object.freeze({
  loop,
  keyframes: Object.freeze(frames.map(([time, values]) => Object.freeze({
    time, pose: Object.freeze(pose(values))
  })))
});

/**
 * Small provider-neutral 2D rig motion library.
 * Angles are degrees; x/y are normalized canvas units; scale is relative to the
 * character's authored size. Character identity/artwork is never mutated here.
 */
export const CHARACTER_MOTION_CLIPS = Object.freeze({
  idle: clip(true, [
    [0, { y: 0, scaleY: 1, expression: 'neutral' }],
    [0.5, { y: -0.012, scaleY: 1.008, expression: 'neutral' }],
    [1, { y: 0, scaleY: 1, expression: 'neutral' }]
  ]),
  walk: clip(true, [
    [0, { y: 0, leftArm: -18, rightArm: 18, leftLeg: 24, rightLeg: -24 }],
    [0.25, { y: -0.035, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 }],
    [0.5, { y: 0, leftArm: 18, rightArm: -18, leftLeg: -24, rightLeg: 24 }],
    [0.75, { y: -0.035, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 }],
    [1, { y: 0, leftArm: -18, rightArm: 18, leftLeg: 24, rightLeg: -24 }]
  ]),
  run: clip(true, [
    [0, { y: -0.025, rotation: -3, leftArm: -42, rightArm: 42, leftLeg: 38, rightLeg: -38 }],
    [0.25, { y: -0.10, rotation: 2, leftArm: 35, rightArm: -35, leftLeg: -35, rightLeg: 35 }],
    [0.5, { y: -0.025, rotation: -3, leftArm: 42, rightArm: -42, leftLeg: 38, rightLeg: -38 }],
    [0.75, { y: -0.10, rotation: 2, leftArm: -35, rightArm: 35, leftLeg: -35, rightLeg: 35 }],
    [1, { y: -0.025, rotation: -3, leftArm: -42, rightArm: 42, leftLeg: 38, rightLeg: -38 }]
  ]),
  jump: clip(false, [
    [0, { y: 0, scaleY: 1, leftArm: 0, rightArm: 0, expression: 'focused' }],
    [0.22, { y: 0.035, scaleY: 0.92, leftArm: -24, rightArm: -24 }],
    [0.58, { y: -0.42, scaleY: 1.06, leftArm: -125, rightArm: -125, leftLeg: 24, rightLeg: -24, expression: 'happy' }],
    [0.82, { y: -0.20, scaleY: 1.02, leftArm: -65, rightArm: -65, leftLeg: 12, rightLeg: -12 }],
    [1, { y: 0, scaleY: 0.96, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0, expression: 'neutral' }]
  ]),
  turn: clip(false, [
    [0, { rotation: 0, headRotation: 0 }],
    [0.35, { rotation: -12, headRotation: -20 }],
    [0.72, { rotation: 78, headRotation: 8 }],
    [1, { rotation: 90, headRotation: 0 }]
  ]),
  talk: clip(false, [
    [0, { headRotation: 0, rightArm: 0, expression: 'neutral' }],
    [0.25, { headRotation: -5, rightArm: -18, expression: 'talking' }],
    [0.5, { headRotation: 3, rightArm: -32, expression: 'talking' }],
    [0.75, { headRotation: -2, rightArm: -14, expression: 'talking' }],
    [1, { headRotation: 0, rightArm: 0, expression: 'neutral' }]
  ]),
  happy: clip(false, [
    [0, { y: 0, headRotation: 0, leftArm: 0, rightArm: 0, expression: 'happy' }],
    [0.35, { y: -0.08, headRotation: -5, leftArm: -35, rightArm: -35, expression: 'happy' }],
    [0.7, { y: -0.02, headRotation: 5, leftArm: -55, rightArm: -55, expression: 'laughing' }],
    [1, { y: 0, headRotation: 0, leftArm: 0, rightArm: 0, expression: 'happy' }]
  ]),
  sad: clip(false, [
    [0, { headRotation: 0, leftArm: 0, rightArm: 0, expression: 'sad' }],
    [0.4, { headRotation: 12, leftArm: 18, rightArm: 18, expression: 'sad' }],
    [0.75, { headRotation: 8, leftArm: 25, rightArm: 25, expression: 'sad' }],
    [1, { headRotation: 0, leftArm: 0, rightArm: 0, expression: 'sad' }]
  ]),
  surprised: clip(false, [
    [0, { headRotation: 0, scaleY: 1, expression: 'neutral' }],
    [0.25, { headRotation: -4, scaleY: 1.08, leftArm: -30, rightArm: -30, expression: 'surprised' }],
    [0.65, { headRotation: 3, scaleY: 1.04, leftArm: -42, rightArm: -42, expression: 'surprised' }],
    [1, { headRotation: 0, scaleY: 1, leftArm: -12, rightArm: -12, expression: 'surprised' }]
  ]),
  dance: clip(true, [
    [0, { rotation: -8, leftArm: -35, rightArm: 35, leftLeg: 12, rightLeg: -12 }],
    [0.25, { rotation: 8, leftArm: 35, rightArm: -35, leftLeg: -12, rightLeg: 12 }],
    [0.5, { rotation: -8, leftArm: -35, rightArm: 35, leftLeg: 12, rightLeg: -12 }],
    [0.75, { rotation: 8, leftArm: 35, rightArm: -35, leftLeg: -12, rightLeg: 12 }],
    [1, { rotation: -8, leftArm: -35, rightArm: 35, leftLeg: 12, rightLeg: -12 }]
  ])
});

export const CHARACTER_MOTION_ACTIONS = Object.freeze(Object.keys(CHARACTER_MOTION_CLIPS));

function interpolatePose(left, right, amount) {
  const t = smoothstep(amount);
  const result = {};
  for (const key of Object.keys(left)) {
    result[key] = typeof left[key] === 'number' && typeof right[key] === 'number'
      ? left[key] + (right[key] - left[key]) * t
      : (t < 0.5 ? left[key] : right[key]);
  }
  return result;
}

/** Sample a normalized 2D character pose at progress 0..1. */
export function sampleCharacterMotion(action, progress = 0, options = {}) {
  const requested = String(action ?? 'idle').trim().toLowerCase();
  const actionName = Object.hasOwn(CHARACTER_MOTION_CLIPS, requested) ? requested : 'idle';
  const selected = CHARACTER_MOTION_CLIPS[actionName];
  const numeric = Number(progress);
  const t = clamp(Number.isFinite(numeric) ? numeric : 0, 0, 1);
  const frames = selected.keyframes;

  let rightIndex = frames.findIndex(frame => frame.time >= t);
  if (rightIndex <= 0) {
    return { action: actionName, progress: t, loop: selected.loop, pose: { ...frames[0].pose } };
  }
  if (rightIndex < 0) rightIndex = frames.length - 1;
  const left = frames[rightIndex - 1];
  const right = frames[rightIndex];
  const span = right.time - left.time;
  const local = span > 0 ? (t - left.time) / span : 0;
  const sampled = interpolatePose(left.pose, right.pose, local);
  return { action: actionName, progress: t, loop: selected.loop, pose: sampled };
}

/** Resolve a scene's explicit motion/action without claiming visual understanding. */
export function getSceneCharacterMotion(scene = {}) {
  const action = scene.characterMotion ?? scene.motionType ?? scene.action ?? 'idle';
  return Object.hasOwn(CHARACTER_MOTION_CLIPS, String(action).toLowerCase())
    ? String(action).toLowerCase()
    : 'idle';
}

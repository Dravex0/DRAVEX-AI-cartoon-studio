import { validateCharacterRig } from './character-rig.js';
import { validateCharacterRigTimeline } from './character-rig-timeline.js';

const PRESETS = Object.freeze({
  idle: { label: 'Idle / Ожидание', frames: 4 },
  walk: { label: 'Walk / Ходьба', frames: 5 },
  run: { label: 'Run / Бег', frames: 5 },
  jump: { label: 'Jump / Прыжок', frames: 5 },
  wave: { label: 'Wave / Приветствие', frames: 5 }
});
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeId = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const roleOf = boneId => {
  const id = normalizeId(boneId);
  if (/root|hips|pelvis|torso|body|spine/.test(id)) return 'root';
  if (/head|neck/.test(id)) return 'head';
  if (/left.*arm|arm.*left|larm|upperarm_l|shoulder_l/.test(id)) return 'leftArm';
  if (/right.*arm|arm.*right|rarm|upperarm_r|shoulder_r/.test(id)) return 'rightArm';
  if (/left.*leg|leg.*left|lleg|thigh_l|foot_l/.test(id)) return 'leftLeg';
  if (/right.*leg|leg.*right|rleg|thigh_r|foot_r/.test(id)) return 'rightLeg';
  if (/arm|hand|shoulder/.test(id)) return 'arm';
  if (/leg|foot|thigh/.test(id)) return 'leg';
  return 'other';
};
const round = value => Math.round(value * 10000) / 10000;

function poseFor(rig, preset, phase) {
  const pose = {};
  const cycle = Math.sin(phase * Math.PI * 2);
  const lift = Math.max(0, Math.sin(phase * Math.PI * 2));
  for (const bone of rig.bones) {
    const role = roleOf(bone.id);
    let rotation = 0, x = 0, y = 0;
    if (preset === 'walk') {
      if (role === 'leftArm' || role === 'arm') rotation = cycle * 0.32;
      if (role === 'rightArm') rotation = -cycle * 0.32;
      if (role === 'leftLeg' || role === 'leg') rotation = -cycle * 0.38;
      if (role === 'rightLeg') rotation = cycle * 0.38;
      if (role === 'root') y = Math.abs(cycle) * 0.018;
      if (role === 'head') rotation = -cycle * 0.025;
    } else if (preset === 'run') {
      if (role === 'leftArm' || role === 'arm') rotation = cycle * 0.62;
      if (role === 'rightArm') rotation = -cycle * 0.62;
      if (role === 'leftLeg' || role === 'leg') rotation = -cycle * 0.72;
      if (role === 'rightLeg') rotation = cycle * 0.72;
      if (role === 'root') y = Math.abs(cycle) * 0.045;
      if (role === 'head') rotation = -cycle * 0.04;
    } else if (preset === 'jump') {
      if (role === 'root') y = -0.2 * lift;
      if (role === 'leftArm' || role === 'arm') rotation = -0.55 * lift;
      if (role === 'rightArm') rotation = 0.55 * lift;
      if (role === 'leftLeg' || role === 'leg') rotation = -0.35 * lift;
      if (role === 'rightLeg') rotation = 0.35 * lift;
    } else if (preset === 'wave') {
      if (role === 'rightArm' || role === 'arm') rotation = -0.8 + 0.22 * Math.sin(phase * Math.PI * 2);
      if (role === 'leftArm') rotation = -0.12;
      if (role === 'head') rotation = 0.06 * Math.sin(phase * Math.PI * 2);
    } else if (preset === 'idle') {
      if (role === 'root') y = 0.008 * Math.sin(phase * Math.PI * 2);
      if (role === 'head') rotation = 0.025 * Math.sin(phase * Math.PI * 2);
      if (role === 'leftArm' || role === 'rightArm' || role === 'arm') rotation = 0.018 * Math.sin(phase * Math.PI * 2);
    }
    if (x || y || rotation) pose[bone.id] = { x: round(clamp(x, -0.5, 0.5)), y: round(clamp(y, -0.5, 0.5)), rotation: round(clamp(rotation, -1.5, 1.5)) };
  }
  return pose;
}

/** Build an explicit, bounded keyframe timeline from a validated segmented character rig. */
export function createCharacterRigMotionPreset(rigInput, presetName) {
  const report = validateCharacterRig(rigInput);
  if (!report.passed) return { status: 'invalid-rig', preset: presetName, timeline: null, issues: report.issues };
  const preset = PRESETS[presetName];
  if (!preset) return { status: 'unknown-preset', preset: presetName, timeline: null, issues: [{ code: 'motion-preset-unknown', message: 'Choose idle, walk, run, jump, or wave.' }] };
  const rig = report.rig;
  const roles = new Set(rig.bones.map(bone => roleOf(bone.id)));
  const warnings = [];
  if (presetName === 'walk' || presetName === 'run') {
    if (![...roles].some(role => role === 'leftLeg' || role === 'rightLeg' || role === 'leg')) warnings.push('No leg-like bone IDs found; this preset will animate only recognized upper-body/root bones.');
    if (![...roles].some(role => role === 'leftArm' || role === 'rightArm' || role === 'arm')) warnings.push('No arm-like bone IDs found; arm swing will be omitted.');
  }
  if (presetName === 'wave' && ![...roles].some(role => role === 'rightArm' || role === 'arm')) {
    warnings.push('No right-arm or generic arm bone found; the greeting gesture cannot be represented by this rig.');
  }
  const keyframes = Array.from({ length: preset.frames }, (_, index) => {
    const time = index / (preset.frames - 1);
    return {
      time: round(time),
      easing: index === 0 ? 'linear' : 'ease-in-out',
      poses: { [rig.characterId]: poseFor(rig, presetName, time) }
    };
  });
  const timeline = { schemaVersion: 1, keyframes };
  const timelineReport = validateCharacterRigTimeline(timeline);
  if (!timelineReport.passed) return { status: 'invalid-timeline', preset: presetName, timeline: null, issues: timelineReport.issues };
  return {
    status: 'ready',
    preset: presetName,
    label: preset.label,
    timeline: timelineReport.timeline,
    animatedBoneIds: [...new Set(keyframes.flatMap(frame => Object.keys(frame.poses[rig.characterId])))],
    warnings
  };
}

export function listCharacterRigMotionPresets() {
  return Object.entries(PRESETS).map(([id, value]) => ({ id, label: value.label }));
}

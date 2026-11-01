import { validateCharacterRig } from './character-rig.js';
import { validateCharacterRigTimeline } from './character-rig-timeline.js';
import { solveCharacterRigLimbPose } from './character-rig-ik.js';

const PRESETS = Object.freeze({
  idle: { label: 'Idle / Ожидание', frames: 4 },
  walk: { label: 'Walk / Ходьба', frames: 9 },
  run: { label: 'Run / Бег', frames: 9 },
  jump: { label: 'Jump / Прыжок', frames: 5 },
  wave: { label: 'Wave / Приветствие', frames: 5 }
});
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeId = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const roleOf = boneId => {
  const id = normalizeId(boneId);
  if (/root|hips|pelvis|torso|body|spine/.test(id)) return 'root';
  if (/head|neck/.test(id)) return 'head';
  // Accept both word-order and common L/R suffix conventions after ID normalization.
  if (/left.*(arm|hand|shoulder)|(arm|hand|shoulder).*left|l(arm|hand|upperarm|shoulder)|(arm|hand|upperarm|shoulder)l/.test(id)) return 'leftArm';
  if (/right.*(arm|hand|shoulder)|(arm|hand|shoulder).*right|r(arm|hand|upperarm|shoulder)|(arm|hand|upperarm|shoulder)r/.test(id)) return 'rightArm';
  if (/left.*(foot|ankle|heel|toe)|(foot|ankle|heel|toe).*left|l(foot|ankle|heel|toe)|(foot|ankle|heel|toe)l/.test(id)) return 'leftFoot';
  if (/right.*(foot|ankle|heel|toe)|(foot|ankle|heel|toe).*right|r(foot|ankle|heel|toe)|(foot|ankle|heel|toe)r/.test(id)) return 'rightFoot';
  if (/foot|ankle|heel|toe/.test(id)) return 'foot';
  // Check lower-leg names before generic leg patterns so shins/calves do not
  // receive the same swing rotation as the upper leg.
  if (/left.*(lowerleg|shin|calf)|(lowerleg|shin|calf).*left|l(lowerleg|shin|calf)|(lowerleg|shin|calf)l/.test(id)) return 'leftLowerLeg';
  if (/right.*(lowerleg|shin|calf)|(lowerleg|shin|calf).*right|r(lowerleg|shin|calf)|(lowerleg|shin|calf)r/.test(id)) return 'rightLowerLeg';
  if (/left.*(leg|thigh)|(leg|thigh).*left|l(leg|thigh)|(leg|thigh)l/.test(id)) return 'leftLeg';
  if (/right.*(leg|thigh)|(leg|thigh).*right|r(leg|thigh)|(leg|thigh)r/.test(id)) return 'rightLeg';
  if (/arm|hand|shoulder/.test(id)) return 'arm';
  if (/leg|thigh/.test(id)) return 'leg';
  return 'other';
};
const round = value => Math.round(value * 10000) / 10000;

function limbChainFor(rig, side) {
  const byRole = role => rig.bones.find(bone => roleOf(bone.id) === role);
  const upper = byRole(side === 'left' ? 'leftLeg' : 'rightLeg');
  const lower = byRole(side === 'left' ? 'leftLowerLeg' : 'rightLowerLeg');
  const foot = byRole(side === 'left' ? 'leftFoot' : 'rightFoot');
  const root = rig.bones.find(bone => roleOf(bone.id) === 'root');
  if (!root || !upper || !lower || !foot
    || ![upper, lower, foot].every(bone => bone.pivotEnabled)
    || lower.parentId?.toLowerCase() !== upper.id.toLowerCase()
    || foot.parentId?.toLowerCase() !== lower.id.toLowerCase()) return null;
  let ancestor = upper;
  const visited = new Set();
  while (ancestor?.parentId && !visited.has(ancestor.id.toLowerCase())) {
    visited.add(ancestor.id.toLowerCase());
    ancestor = rig.bones.find(bone => bone.id.toLowerCase() === ancestor.parentId.toLowerCase());
  }
  if (ancestor?.id.toLowerCase() !== root.id.toLowerCase()) return null;
  const upperLength = Math.hypot(lower.pivotX - upper.pivotX, lower.pivotY - upper.pivotY);
  const lowerLength = Math.hypot(foot.pivotX - lower.pivotX, foot.pivotY - lower.pivotY);
  if (!upperLength || !lowerLength || upperLength > 2 || lowerLength > 2) return null;
  const restDx = foot.pivotX - upper.pivotX;
  const restDy = foot.pivotY - upper.pivotY;
  const minimumReach = Math.abs(upperLength - lowerLength);
  const maximumReach = upperLength + lowerLength;
  const restDistance = Math.hypot(restDx, restDy);
  if (restDistance < minimumReach || restDistance > maximumReach) return null;
  const maxHorizontal = Math.sqrt(Math.max(0, maximumReach * maximumReach - restDy * restDy));
  const minHorizontal = Math.abs(restDy) < minimumReach
    ? Math.sqrt(Math.max(0, minimumReach * minimumReach - restDy * restDy))
    : 0;
  const outwardMargin = maxHorizontal - Math.abs(restDx);
  const inwardMargin = minHorizontal > 0 ? Math.abs(restDx) - minHorizontal : Number.POSITIVE_INFINITY;
  const safeStride = Math.max(0, Math.min(outwardMargin, inwardMargin));
  const cross = (lower.pivotX - upper.pivotX) * (foot.pivotY - upper.pivotY)
    - (lower.pivotY - upper.pivotY) * (foot.pivotX - upper.pivotX);
  return { root, upper, lower, foot, upperLength, lowerLength, safeStride, bendDirection: cross >= 0 ? 1 : -1 };
}

function plantedGaitChains(rig) {
  const left = limbChainFor(rig, 'left');
  const right = limbChainFor(rig, 'right');
  return left && right && left.root.id === right.root.id
    && Math.min(left.safeStride, right.safeStride) > 0.005
    ? { left, right, maxSafeStride: Math.min(left.safeStride, right.safeStride) * 0.8 }
    : null;
}

function applyPlantedGaitPose(rig, pose, phase, preset, rootBob, chains) {
  if (!chains) return false;
  const strideScale = preset === 'run' ? 0.15 : 0.12;
  const nominalStride = Math.min(
    chains.left.upperLength + chains.left.lowerLength,
    chains.right.upperLength + chains.right.lowerLength
  ) * strideScale;
  const stride = Math.min(nominalStride, chains.maxSafeStride);
  const liftHeight = clamp(Math.min(
    chains.left.upperLength + chains.left.lowerLength,
    chains.right.upperLength + chains.right.lowerLength
  ) * (preset === 'run' ? 0.22 : 0.14), 0.02, preset === 'run' ? 0.11 : 0.075);
  const rootX = phase * stride;
  const candidatePose = { ...pose };
  const rootPose = candidatePose[chains.left.root.id] || {};
  candidatePose[chains.left.root.id] = { ...rootPose, x: round(rootX), y: round(rootBob) };
  const solvedLegs = [];

  for (const [side, chain] of [['left', chains.left], ['right', chains.right]]) {
    const isLeft = side === 'left';
    const stance = isLeft ? phase <= 0.5 : phase >= 0.5;
    const swingProgress = isLeft ? (phase - 0.5) * 2 : phase * 2;
    const progress = clamp(swingProgress, 0, 1);
    const smoothProgress = progress * progress * (3 - 2 * progress);
    const desiredWorldX = isLeft
      ? chain.foot.pivotX + (stance ? 0 : stride * smoothProgress)
      : chain.foot.pivotX + (stance ? 0 : -stride * (1 - smoothProgress));
    const swingLift = stance ? 0 : Math.sin(Math.PI * progress) * liftHeight;
    const target = {
      x: desiredWorldX - rootX,
      y: chain.foot.pivotY - swingLift - rootBob
    };
    const solved = solveCharacterRigLimbPose(rig, {
      upperBoneId: chain.upper.id,
      lowerBoneId: chain.lower.id,
      endBoneId: chain.foot.id,
      target,
      bendDirection: chain.bendDirection
    });
    // A clamped IK solution is mathematically valid but cannot plant the
    // requested ankle. Reject it instead of silently accepting foot sliding.
    if (solved.status !== 'solved' || solved.reachable !== true) return false;
    solvedLegs.push({ chain, solved });
  }
  // Commit both legs together. If either solve fails, retain the complete
  // legacy pose instead of mixing one IK leg with one procedural leg.
  for (const { chain, solved } of solvedLegs) {
    candidatePose[chain.upper.id] = { ...(candidatePose[chain.upper.id] || {}), rotation: round(solved.pose[chain.upper.id].rotation) };
    candidatePose[chain.lower.id] = { ...(candidatePose[chain.lower.id] || {}), rotation: round(solved.pose[chain.lower.id].rotation) };
  }
  Object.assign(pose, candidatePose);
  return true;
}

function poseFor(rig, preset, phase) {
  const pose = {};
  const cycle = Math.sin(phase * Math.PI * 2);
  const lift = Math.max(0, Math.sin(phase * Math.PI * 2));
  const rootBob = preset === 'walk'
    ? Math.abs(cycle) * 0.018
    : preset === 'run' ? Math.abs(cycle) * 0.045 : 0;
  const gaitChains = ['walk', 'run'].includes(preset) ? plantedGaitChains(rig) : null;
  for (const bone of rig.bones) {
    const role = roleOf(bone.id);
    let rotation = 0, x = 0, y = 0;
    if (preset === 'walk') {
      if (role === 'leftArm' || role === 'arm') rotation = cycle * 0.32;
      if (role === 'rightArm') rotation = -cycle * 0.32;
      if (role === 'leftLeg' || role === 'leg') rotation = -cycle * 0.38;
      if (role === 'rightLeg') rotation = cycle * 0.38;
      if (role === 'leftLowerLeg' && bone.pivotEnabled) rotation = lift * 0.42;
      if (role === 'rightLowerLeg' && bone.pivotEnabled) rotation = Math.max(0, -cycle) * 0.42;
      if (role === 'root') y = rootBob;
      if (role === 'head') rotation = -cycle * 0.025;
    } else if (preset === 'run') {
      if (role === 'leftArm' || role === 'arm') rotation = cycle * 0.62;
      if (role === 'rightArm') rotation = -cycle * 0.62;
      if (role === 'leftLeg' || role === 'leg') rotation = -cycle * 0.72;
      if (role === 'rightLeg') rotation = cycle * 0.72;
      if (role === 'leftLowerLeg' && bone.pivotEnabled) rotation = lift * 0.68;
      if (role === 'rightLowerLeg' && bone.pivotEnabled) rotation = Math.max(0, -cycle) * 0.68;
      if (role === 'root') y = rootBob;
      if (role === 'head') rotation = -cycle * 0.04;
    } else if (preset === 'jump') {
      if (role === 'root') y = -0.2 * lift;
      if (role === 'leftArm' || role === 'arm') rotation = -0.55 * lift;
      if (role === 'rightArm') rotation = 0.55 * lift;
      if (role === 'leftLeg' || role === 'leg') rotation = -0.35 * lift;
      if (role === 'rightLeg') rotation = 0.35 * lift;
      if (role === 'leftLowerLeg' && bone.pivotEnabled) rotation = 0.24 * lift;
      if (role === 'rightLowerLeg' && bone.pivotEnabled) rotation = 0.24 * lift;
    } else if (preset === 'wave') {
      if (role === 'rightArm' || role === 'arm') rotation = -0.8 + 0.22 * Math.sin(phase * Math.PI * 2);
      if (role === 'leftArm') rotation = -0.12;
      if (role === 'head') rotation = 0.06 * Math.sin(phase * Math.PI * 2);
    } else if (preset === 'idle') {
      if (role === 'root') y = 0.008 * Math.sin(phase * Math.PI * 2);
      if (role === 'head') rotation = 0.025 * Math.sin(phase * Math.PI * 2);
      if (role === 'leftArm' || role === 'rightArm' || role === 'arm') rotation = 0.018 * Math.sin(phase * Math.PI * 2);
    }
    // Counter the root's vertical bounce at foot bones so the planted foot
    // does not inherit that extra body motion. This is not full inverse kinematics.
    if (!gaitChains && (role === 'leftFoot' || role === 'rightFoot' || role === 'foot')) y = -rootBob;
    if (x || y || rotation) pose[bone.id] = { x: round(clamp(x, -0.5, 0.5)), y: round(clamp(y, -0.5, 0.5)), rotation: round(clamp(rotation, -1.5, 1.5)) };
  }
  if (gaitChains) applyPlantedGaitPose(rig, pose, phase, preset, rootBob, gaitChains);
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
    if (![...roles].some(role => role === 'foot' || role === 'leftFoot' || role === 'rightFoot')) warnings.push('No foot-like bone IDs found; root bounce cannot be compensated at the feet, so planted-foot contact is not represented.');
    else if (!plantedGaitChains(rig)) warnings.push('Foot-planting IK is disabled: walk/run requires complete left and right hip-knee-ankle chains with enabled pivots. The legacy motion preset is retained.');
  }
  const lowerLegBones = rig.bones.filter(bone => ['leftLowerLeg', 'rightLowerLeg'].includes(roleOf(bone.id)));
  if (['walk', 'run', 'jump'].includes(presetName) && lowerLegBones.some(bone => !bone.pivotEnabled)) {
    warnings.push('One or more lower-leg bones have no knee pivots defined; knee bending is omitted for those bones to avoid rotating around an unknown joint.');
  }
  if (presetName === 'wave' && ![...roles].some(role => role === 'rightArm' || role === 'arm')) {
    warnings.push('No right-arm or generic arm bone found; the greeting gesture cannot be represented by this rig.');
  }
  const gaitChains = ['walk', 'run'].includes(presetName) ? plantedGaitChains(rig) : null;
  const keyframes = Array.from({ length: preset.frames }, (_, index) => {
    const time = index / (preset.frames - 1);
    return {
      time: round(time),
      // Cyclic motions must keep moving through intermediate frames; easing each
      // segment independently introduces an artificial stop at every keyframe.
      easing: presetName === 'jump' && index > 0 ? 'ease-in-out' : 'linear',
      poses: { [rig.characterId]: poseFor(rig, presetName, time) }
    };
  });
  if (gaitChains && keyframes.some(frame => (
    typeof frame.poses[rig.characterId]?.[gaitChains.left.root.id]?.x !== 'number'
  ))) {
    warnings.push('Foot-planting IK could not reach one or more requested ankle targets; the complete legacy walk/run pose was kept for those frames.');
  }
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

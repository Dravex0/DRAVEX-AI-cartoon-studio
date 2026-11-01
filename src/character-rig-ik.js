const MAX_SEGMENT_LENGTH = 2;
const EPSILON = 1e-9;
const finitePoint = point => Boolean(
  point && typeof point === 'object' && !Array.isArray(point)
  && typeof point.x === 'number' && Number.isFinite(point.x)
  && typeof point.y === 'number' && Number.isFinite(point.y)
);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Solve a planar two-segment limb from a fixed root toward a target.
 * Coordinates use the scene's normalized viewport space (positive Y points down).
 * The returned endpoint is clamped to the limb's reachable annulus when necessary.
 */
export function solveTwoBoneIK({
  root,
  target,
  upperLength,
  lowerLength,
  bendDirection = 1
} = {}) {
  if (!finitePoint(root) || !finitePoint(target)
    || typeof upperLength !== 'number' || !Number.isFinite(upperLength)
    || typeof lowerLength !== 'number' || !Number.isFinite(lowerLength)
    || upperLength <= 0 || lowerLength <= 0
    || upperLength > MAX_SEGMENT_LENGTH || lowerLength > MAX_SEGMENT_LENGTH
    || typeof bendDirection !== 'number' || !Number.isFinite(bendDirection)) {
    return {
      status: 'invalid-input',
      reachable: false,
      joint: null,
      end: null,
      angles: null
    };
  }

  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const targetDistance = Math.hypot(dx, dy);
  const minimumReach = Math.abs(upperLength - lowerLength);
  const maximumReach = upperLength + lowerLength;
  const solvedDistance = clamp(targetDistance, minimumReach, maximumReach);
  const directionAngle = targetDistance > EPSILON ? Math.atan2(dy, dx) : 0;
  const safeDistance = Math.max(solvedDistance, EPSILON);
  const cosine = clamp(
    (upperLength * upperLength + safeDistance * safeDistance - lowerLength * lowerLength)
      / (2 * upperLength * safeDistance),
    -1,
    1
  );
  const bendAngle = Math.acos(cosine) * (bendDirection < 0 ? -1 : 1);
  const upperAngle = directionAngle + bendAngle;
  const joint = {
    x: root.x + Math.cos(upperAngle) * upperLength,
    y: root.y + Math.sin(upperAngle) * upperLength
  };
  const end = {
    x: root.x + Math.cos(directionAngle) * solvedDistance,
    y: root.y + Math.sin(directionAngle) * solvedDistance
  };
  const lowerAngle = Math.atan2(end.y - joint.y, end.x - joint.x);
  const reachable = targetDistance >= minimumReach - EPSILON
    && targetDistance <= maximumReach + EPSILON;

  return {
    status: 'solved',
    reachable,
    targetDistance,
    solvedDistance,
    joint,
    end,
    angles: { upper: upperAngle, lower: lowerAngle }
  };
}

export const TWO_BONE_IK_LIMITS = Object.freeze({
  maxSegmentLength: MAX_SEGMENT_LENGTH
});


import { validateCharacterRig } from './character-rig.js';

const normalizeAngle = value => {
  let angle = value;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
};

/**
 * Convert a validated three-pivot limb chain into bone rotation deltas.
 * The upper, lower, and end bone pivots represent hip, knee, and ankle in
 * normalized scene coordinates. Segment lengths are measured from those
 * rest-pose joint coordinates so applying the deltas preserves the authored
 * limb geometry exactly.
 */
export function solveCharacterRigLimbPose(rigInput, {
  upperBoneId,
  lowerBoneId,
  endBoneId,
  target,
  bendDirection = 1
} = {}) {
  const report = validateCharacterRig(rigInput);
  if (!report.passed) {
    return { status: 'invalid-rig', pose: null, issues: report.issues };
  }
  const bones = report.rig.bones;
  const findBone = id => bones.find(bone => bone.id.toLowerCase() === String(id ?? '').toLowerCase());
  const upper = findBone(upperBoneId);
  const lower = findBone(lowerBoneId);
  const end = findBone(endBoneId);
  if (!upper || !lower || !end || new Set([upper.id, lower.id, end.id].map(id => id.toLowerCase())).size !== 3
    || lower.parentId?.toLowerCase() !== upper.id.toLowerCase()
    || end.parentId?.toLowerCase() !== lower.id.toLowerCase()) {
    return {
      status: 'invalid-chain',
      pose: null,
      issues: [{ code: 'ik-chain-invalid', message: 'The IK chain must contain distinct upper, lower, and end bones connected in that parent order.' }]
    };
  }
  if (![upper, lower, end].every(bone => bone.pivotEnabled)) {
    return {
      status: 'missing-pivots',
      pose: null,
      issues: [{ code: 'ik-pivots-missing', message: 'The upper, lower, and end bones must each define an enabled joint pivot.' }]
    };
  }

  const upperLength = Math.hypot(lower.pivotX - upper.pivotX, lower.pivotY - upper.pivotY);
  const lowerLength = Math.hypot(end.pivotX - lower.pivotX, end.pivotY - lower.pivotY);
  const solution = solveTwoBoneIK({
    root: { x: upper.pivotX, y: upper.pivotY },
    target,
    upperLength,
    lowerLength,
    bendDirection
  });
  if (solution.status !== 'solved') {
    return {
      status: 'invalid-limb-geometry',
      pose: null,
      issues: [{ code: 'ik-limb-geometry-invalid', message: 'The rest-pose joint spacing must define two finite, non-zero segments within the supported length range.' }]
    };
  }

  const restUpperAngle = Math.atan2(lower.pivotY - upper.pivotY, lower.pivotX - upper.pivotX);
  const restLowerAngle = Math.atan2(end.pivotY - lower.pivotY, end.pivotX - lower.pivotX);
  const upperDelta = normalizeAngle(solution.angles.upper - restUpperAngle);
  const lowerDelta = normalizeAngle(solution.angles.lower - restLowerAngle - upperDelta);

  return {
    status: 'solved',
    reachable: solution.reachable,
    target: { x: target.x, y: target.y },
    solvedEnd: solution.end,
    joint: solution.joint,
    segmentLengths: { upper: upperLength, lower: lowerLength },
    pose: {
      [upper.id]: { rotation: upperDelta },
      [lower.id]: { rotation: lowerDelta }
    },
    issues: []
  };
}

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

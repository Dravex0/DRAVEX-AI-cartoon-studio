import { validateCharacterRig } from './character-rig.js';

const LIMB_JOINTS = Object.freeze([
  { id: 'left-elbow', upper: 'arm-left-upper', lower: 'arm-left-lower' },
  { id: 'right-elbow', upper: 'arm-right-upper', lower: 'arm-right-lower' },
  { id: 'left-knee', upper: 'leg-left-upper', lower: 'leg-left-lower' },
  { id: 'right-knee', upper: 'leg-right-upper', lower: 'leg-right-lower' }
]);

const MIN_OVERLAP_RATIO = 0.08;

/**
 * Check whether adjacent limb-part placement rectangles overlap in the neutral pose.
 * This catches obvious layout gaps; it does not inspect alpha pixels or prove that
 * generated artwork contains correctly drawn joints.
 */
export function auditCharacterRigJointGeometry(rigInput, options = {}) {
  const report = validateCharacterRig(rigInput);
  if (!report.passed) {
    return {
      status: 'invalid-rig',
      passed: false,
      characterId: report.rig.characterId,
      joints: [],
      issues: report.issues.map(issue => ({ code: issue.code, message: issue.message })),
      limitation: 'Geometry checks cannot validate image pixels, transparency, occlusion or semantic anatomy.'
    };
  }

  const minimumOverlapRatio = Number.isFinite(options.minimumOverlapRatio)
    ? Math.max(0, Math.min(1, options.minimumOverlapRatio))
    : MIN_OVERLAP_RATIO;
  const parts = new Map(report.rig.parts.map(part => [part.id, part]));
  const joints = [];
  const issues = [];

  for (const joint of LIMB_JOINTS) {
    const upper = parts.get(joint.upper);
    const lower = parts.get(joint.lower);
    if (!upper || !lower) {
      const missing = [!upper ? joint.upper : null, !lower ? joint.lower : null].filter(Boolean);
      issues.push({
        code: 'joint-part-missing',
        jointId: joint.id,
        partIds: missing,
        message: 'Both adjacent limb parts are required for a joint geometry check.'
      });
      joints.push({ jointId: joint.id, status: 'missing-parts', overlapRatio: 0, partIds: [joint.upper, joint.lower] });
      continue;
    }

    // The neutral-pose rectangles use normalized viewport coordinates.
    const left = Math.max(upper.x - upper.width / 2, lower.x - lower.width / 2);
    const top = Math.max(upper.y - upper.height / 2, lower.y - lower.height / 2);
    const right = Math.min(upper.x + upper.width / 2, lower.x + lower.width / 2);
    const bottom = Math.min(upper.y + upper.height / 2, lower.y + lower.height / 2);
    const intersectionArea = Math.max(0, right - left) * Math.max(0, bottom - top);
    const smallerArea = Math.min(upper.width * upper.height, lower.width * lower.height);
    const overlapRatio = smallerArea > 0 ? intersectionArea / smallerArea : 0;
    const passed = overlapRatio >= minimumOverlapRatio;

    joints.push({
      jointId: joint.id,
      status: passed ? 'overlap-ok' : 'gap-or-insufficient-overlap',
      partIds: [joint.upper, joint.lower],
      overlapRatio: Number(overlapRatio.toFixed(4)),
      minimumOverlapRatio
    });
    if (!passed) {
      issues.push({
        code: 'joint-geometry-gap',
        jointId: joint.id,
        partIds: [joint.upper, joint.lower],
        overlapRatio: Number(overlapRatio.toFixed(4)),
        minimumOverlapRatio,
        message: 'Adjacent limb placement rectangles do not overlap enough in the neutral pose.'
      });
    }
  }

  const passed = issues.length === 0;
  return {
    status: passed ? 'passed' : 'needs-correction',
    passed,
    characterId: report.rig.characterId,
    joints,
    issues,
    geometrySource: 'neutral-pose-axis-aligned-part-rectangles',
    limitation: 'This detects layout gaps only. It does not inspect alpha pixels, artwork edges, occlusion, perspective or semantic anatomy; visual review is still required.'
  };
}

export const CHARACTER_RIG_JOINT_AUDIT_LIMITS = Object.freeze({
  minimumOverlapRatio: MIN_OVERLAP_RATIO,
  joints: LIMB_JOINTS.length
});

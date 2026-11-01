import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { solveTwoBoneIK } from '../src/character-rig-ik.js';

const close = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${actual} to be close to ${expected}`);
};

describe('two-bone inverse kinematics foundation', () => {
  it('solves a reachable target and preserves both segment lengths', () => {
    const result = solveTwoBoneIK({
      root: { x: 0, y: 0 },
      target: { x: 1, y: 0 },
      upperLength: 0.75,
      lowerLength: 0.75
    });
    assert.equal(result.status, 'solved');
    assert.equal(result.reachable, true);
    close(Math.hypot(result.joint.x, result.joint.y), 0.75);
    close(Math.hypot(result.end.x - result.joint.x, result.end.y - result.joint.y), 0.75);
    close(result.end.x, 1);
    close(result.end.y, 0);
  });

  it('changes the knee bend side without changing reachability', () => {
    const input = {
      root: { x: 0.2, y: 0.2 },
      target: { x: 0.9, y: 0.2 },
      upperLength: 0.5,
      lowerLength: 0.5
    };
    const positive = solveTwoBoneIK({ ...input, bendDirection: 1 });
    const negative = solveTwoBoneIK({ ...input, bendDirection: -1 });
    assert.equal(positive.reachable, true);
    assert.equal(negative.reachable, true);
    assert.ok(positive.joint.y > input.root.y);
    assert.ok(negative.joint.y < input.root.y);
    close(positive.end.x, negative.end.x);
    close(positive.end.y, negative.end.y);
  });

  it('clamps an unreachable distant target to maximum extension', () => {
    const result = solveTwoBoneIK({
      root: { x: 0, y: 0 },
      target: { x: 4, y: 0 },
      upperLength: 0.6,
      lowerLength: 0.4
    });
    assert.equal(result.status, 'solved');
    assert.equal(result.reachable, false);
    close(result.solvedDistance, 1);
    close(Math.hypot(result.end.x, result.end.y), 1);
  });

  it('clamps a target inside the minimum reach for unequal segments', () => {
    const result = solveTwoBoneIK({
      root: { x: 0, y: 0 },
      target: { x: 0.1, y: 0 },
      upperLength: 0.8,
      lowerLength: 0.3
    });
    assert.equal(result.reachable, false);
    close(result.solvedDistance, 0.5);
    close(Math.hypot(result.end.x, result.end.y), 0.5);
  });

  it('handles a target exactly at the root without producing non-finite coordinates', () => {
    const result = solveTwoBoneIK({
      root: { x: 0.4, y: 0.5 },
      target: { x: 0.4, y: 0.5 },
      upperLength: 0.5,
      lowerLength: 0.5
    });
    assert.equal(result.status, 'solved');
    assert.ok(Number.isFinite(result.joint.x));
    assert.ok(Number.isFinite(result.joint.y));
    assert.ok(Number.isFinite(result.angles.upper));
    assert.ok(Number.isFinite(result.angles.lower));
    close(result.end.x, 0.4);
    close(result.end.y, 0.5);
  });

  it('rejects missing, non-finite, zero, and out-of-contract segment inputs', () => {
    for (const input of [
      {},
      { root: { x: 0, y: 0 }, target: { x: 1, y: 0 }, upperLength: 0, lowerLength: 1 },
      { root: { x: 0, y: 0 }, target: { x: 1, y: 0 }, upperLength: 1, lowerLength: Number.NaN },
      { root: { x: 0, y: 0 }, target: { x: Infinity, y: 0 }, upperLength: 1, lowerLength: 1 },
      { root: { x: 0, y: 0 }, target: { x: 1, y: 0 }, upperLength: 2.1, lowerLength: 1 }
    ]) {
      assert.equal(solveTwoBoneIK(input).status, 'invalid-input');
    }
  });
});


import { applyCharacterRigPose } from '../src/character-rig.js';
import { solveCharacterRigLimbPose } from '../src/character-rig-ik.js';

describe('character rig IK pose mapping', () => {
  const limbRig = () => ({
    schemaVersion: 1,
    characterId: 'Foxy',
    bones: [
      { id: 'hips', parentId: null, pivotX: 0.5, pivotY: 0.35 },
      { id: 'leftLeg', parentId: 'hips', pivotX: 0.5, pivotY: 0.35 },
      { id: 'leftShin', parentId: 'leftLeg', pivotX: 0.42, pivotY: 0.58 },
      { id: 'leftFoot', parentId: 'leftShin', pivotX: 0.48, pivotY: 0.78 }
    ],
    parts: [
      { id: 'body', boneId: 'hips', imageUrl: 'https://assets.example/body.png', x: 0.5, y: 0.35 },
      { id: 'ankle-marker', boneId: 'leftFoot', imageUrl: 'https://assets.example/marker.png', x: 0.48, y: 0.78 }
    ]
  });

  it('maps a reachable ankle target into parent-relative upper and lower bone rotations', () => {
    const rig = limbRig();
    const target = { x: 0.62, y: 0.68 };
    const result = solveCharacterRigLimbPose(rig, {
      upperBoneId: 'leftLeg',
      lowerBoneId: 'leftShin',
      endBoneId: 'leftFoot',
      target,
      bendDirection: 1
    });
    assert.equal(result.status, 'solved');
    assert.equal(result.reachable, true);
    assert.ok(Number.isFinite(result.pose.leftLeg.rotation));
    assert.ok(Number.isFinite(result.pose.leftShin.rotation));
    const [ankle] = applyCharacterRigPose(
      [rig.parts[1]],
      rig,
      result.pose
    );
    close(ankle.x, target.x);
    close(ankle.y, target.y);
  });

  it('reports an unreachable target while returning a clamped valid pose', () => {
    const result = solveCharacterRigLimbPose(limbRig(), {
      upperBoneId: 'leftLeg',
      lowerBoneId: 'leftShin',
      endBoneId: 'leftFoot',
      target: { x: 1.8, y: 1.8 }
    });
    assert.equal(result.status, 'solved');
    assert.equal(result.reachable, false);
    assert.ok(Number.isFinite(result.pose.leftLeg.rotation));
    assert.ok(Number.isFinite(result.pose.leftShin.rotation));
  });

  it('rejects missing pivots and incorrectly connected bone chains', () => {
    const rig = limbRig();
    rig.bones[2].pivotEnabled = false;
    const missing = solveCharacterRigLimbPose(rig, {
      upperBoneId: 'leftLeg', lowerBoneId: 'leftShin', endBoneId: 'leftFoot',
      target: { x: 0.6, y: 0.7 }
    });
    assert.equal(missing.status, 'missing-pivots');

    const invalidChain = solveCharacterRigLimbPose(limbRig(), {
      upperBoneId: 'leftLeg', lowerBoneId: 'leftFoot', endBoneId: 'leftShin',
      target: { x: 0.6, y: 0.7 }
    });
    assert.equal(invalidChain.status, 'invalid-chain');
  });

  it('rejects zero-length rest-pose segments instead of fabricating a pose', () => {
    const rig = limbRig();
    rig.bones[2].pivotX = rig.bones[1].pivotX;
    rig.bones[2].pivotY = rig.bones[1].pivotY;
    const result = solveCharacterRigLimbPose(rig, {
      upperBoneId: 'leftLeg', lowerBoneId: 'leftShin', endBoneId: 'leftFoot',
      target: { x: 0.6, y: 0.7 }
    });
    assert.equal(result.status, 'invalid-limb-geometry');
  });
});

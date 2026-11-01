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
    close(Math.hypot(result.end.x - result.root?.x || result.end.x, result.end.y), 1);
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

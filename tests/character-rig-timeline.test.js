import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCharacterRigTimeline,
  validateCharacterRigTimeline,
  sampleCharacterRigTimeline
} from '../src/character-rig-timeline.js';

const validTimeline = () => ({
  schemaVersion: 1,
  keyframes: [
    { time: 0, poses: { Foxy: { arm: { rotation: 0, x: 0 } } } },
    { time: 1, easing: 'linear', poses: { Foxy: { arm: { rotation: 1, x: 0.4 } } } }
  ]
});

describe('character rig keyframe timeline', () => {
  it('validates a normalized start-to-end bone animation', () => {
    assert.equal(validateCharacterRigTimeline(validTimeline()).status, 'valid');
  });

  it('rejects missing endpoints and duplicate or reversed keyframe times', () => {
    const missingStart = validTimeline();
    missingStart.keyframes[0].time = 0.1;
    assert.ok(validateCharacterRigTimeline(missingStart).issues.some(issue => issue.code === 'rig-timeline-start-missing'));
    const duplicate = validTimeline();
    duplicate.keyframes[1].time = 0;
    assert.ok(validateCharacterRigTimeline(duplicate).issues.some(issue => issue.code === 'rig-timeline-order-invalid'));
  });

  it('samples linearly between explicit bone poses and holds endpoint poses', () => {
    const timeline = validTimeline();
    const middle = sampleCharacterRigTimeline(timeline, 0.5);
    assert.ok(Math.abs(middle.Foxy.arm.rotation - 0.5) < 1e-9);
    assert.ok(Math.abs(middle.Foxy.arm.x - 0.2) < 1e-9);
    assert.equal(sampleCharacterRigTimeline(timeline, -1).Foxy.arm.rotation, 0);
    assert.equal(sampleCharacterRigTimeline(timeline, 2).Foxy.arm.rotation, 1);
  });

  it('uses the destination keyframe easing profile', () => {
    const timeline = validTimeline();
    timeline.keyframes[1].easing = 'ease-in';
    const middle = sampleCharacterRigTimeline(timeline, 0.5);
    assert.ok(Math.abs(middle.Foxy.arm.rotation - 0.25) < 1e-9);
  });

  it('interpolates missing bones from a neutral pose and clamps unsafe values', () => {
    const timeline = validTimeline();
    timeline.keyframes[0].poses.Foxy.arm.rotation = 99;
    timeline.keyframes[1].poses.Foxy.leg = { y: -99 };
    const normalized = normalizeCharacterRigTimeline(timeline);
    assert.equal(normalized.keyframes[0].poses.Foxy.arm.rotation, Math.PI * 2);
    assert.equal(normalized.keyframes[1].poses.Foxy.leg.y, -2);
    const sampled = sampleCharacterRigTimeline(timeline, 1);
    assert.equal(sampled.Foxy.leg.y, -2);
  });

  it('returns no animated pose for an invalid timeline', () => {
    assert.deepEqual(sampleCharacterRigTimeline({ schemaVersion: 1, keyframes: [] }, 0.5), {});
  });
});

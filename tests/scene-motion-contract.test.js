import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSceneMotionContract, auditStoryboardMotionContracts } from '../src/scene-motion-contract.js';

const rig = () => ({
  characterId: 'Foxy',
  bones: [
    { id: 'root' },
    { id: 'leftLeg' },
    { id: 'rightLeg' },
    { id: 'leftArm' },
    { id: 'rightArm' },
    { id: 'head' }
  ]
});

function rigTimeline({ rootY = 0, leftLeg = 0, rightLeg = 0, leftArm = 0, rightArm = 0 } = {}) {
  const pose = { root: { y: rootY }, leftLeg: { rotation: leftLeg }, rightLeg: { rotation: rightLeg },
    leftArm: { rotation: leftArm }, rightArm: { rotation: rightArm } };
  return {
    schemaVersion: 1,
    keyframes: [
      { time: 0, poses: { Foxy: { root: {}, leftLeg: {}, rightLeg: {}, leftArm: {}, rightArm: {} } } },
      { time: 0.5, poses: { Foxy: pose } },
      { time: 1, poses: { Foxy: { root: {}, leftLeg: {}, rightLeg: {}, leftArm: {}, rightArm: {} } } }
    ]
  };
}

test('matches the selected motion prompt to actual changing leg keyframes', () => {
  const report = auditSceneMotionContract({
    id: 'scene-walk',
    motionPrompt: 'The fox walks forward.',
    storyDetail: 'The fox attacks a monster.',
    characters: ['Foxy'],
    characterRigs: [rig()],
    characterRigTimeline: rigTimeline({ rootY: 0.04, leftLeg: 0.3, rightLeg: -0.3 })
  });
  assert.equal(report.action.intent, 'walk');
  assert.equal(report.action.sourceField, 'motionPrompt');
  assert.equal(report.animationStatus, 'rig-motion-metadata-covers-action');
  assert.deepEqual(report.coveredGroups, ['legs']);
  assert.deepEqual(report.missingGroups, []);
  assert.ok(report.animatedBones.some(item => item.boneId === 'leftLeg'));
});

test('reports partial coverage when a walk only animates the root', () => {
  const report = auditSceneMotionContract({
    motionPrompt: 'The fox runs toward the gate.',
    characters: ['Foxy'],
    characterRigs: [rig()],
    characterRigTimeline: rigTimeline({ rootY: 0.05 })
  });
  assert.equal(report.animationStatus, 'partial-rig-motion-coverage');
  assert.deepEqual(report.missingGroups, ['legs']);
});

test('does not treat sprite translation as skeletal animation', () => {
  const report = auditSceneMotionContract({
    visibleAction: 'Лисёнок прыгает через ручей.',
    characterMotionTimeline: {
      schemaVersion: 1,
      phases: [{
        phase: 'action', start: 0, end: 1, actorId: 'Foxy',
        description: 'Лисёнок прыгает через ручей.',
        evidence: 'Лисёнок прыгает через ручей.',
        motion: { from: { x: 0.4, y: 0.7 }, to: { x: 0.6, y: 0.4 } }
      }]
    }
  });
  assert.equal(report.spriteMotionDefined, true);
  assert.equal(report.rigTimelineStatus, 'not-provided');
  assert.equal(report.animationStatus, 'sprite-motion-only');
});

test('flags a supplied rig timeline with no changing bone transforms', () => {
  const report = auditSceneMotionContract({
    motionPrompt: 'The fox waves.',
    characters: ['Foxy'],
    characterRigs: [rig()],
    characterRigTimeline: rigTimeline()
  });
  assert.equal(report.animationStatus, 'rig-timeline-has-no-changing-bones');
});

test('reports invalid rig timeline instead of claiming motion coverage', () => {
  const report = auditSceneMotionContract({
    motionPrompt: 'The fox attacks.',
    characterRigTimeline: { schemaVersion: 1, keyframes: [{ time: 0, poses: {} }] }
  });
  assert.equal(report.rigTimelineStatus, 'invalid');
  assert.equal(report.animationStatus, 'invalid-rig-timeline');
});

test('keeps scenes without a detectable action out of the coverage denominator', () => {
  const report = auditStoryboardMotionContracts([
    { title: 'A quiet forest', description: 'A quiet forest at sunrise.' },
    { motionPrompt: 'The fox jumps.', characters: ['Foxy'], characterRigs: [rig()], characterRigTimeline: rigTimeline({ rootY: 0.2, leftLeg: 0.2, rightLeg: -0.2 }) }
  ]);
  assert.equal(report.sceneCount, 2);
  assert.equal(report.actionSceneCount, 1);
  assert.equal(report.coverage, 100);
  assert.equal(report.items[0].animationStatus, 'no-action-cue');
});

test('distinguishes changed timeline data with no character rig binding', () => {
  const report = auditSceneMotionContract({
    motionPrompt: 'The fox attacks.',
    characters: ['Foxy'],
    characterRigTimeline: rigTimeline({ leftArm: 0.7 })
  });
  assert.equal(report.animationStatus, 'rig-character-binding-missing');
});

test('recognizes a sprite motion target when the start pose is implicit', () => {
  const report = auditSceneMotionContract({
    motionPrompt: 'The fox walks to the right.',
    characterMotionTimeline: {
      schemaVersion: 1,
      phases: [{ phase: 'action', start: 0, end: 1, actorId: 'Foxy',
        description: 'The fox walks to the right.', evidence: 'The fox walks to the right.',
        motion: { to: { x: 0.8 } } }]
    }
  });
  assert.equal(report.spriteMotionDefined, true);
  assert.equal(report.animationStatus, 'sprite-motion-only');
});

test('handles malformed storyboard entries without throwing', () => {
  const report = auditStoryboardMotionContracts([null, 'not-a-scene']);
  assert.equal(report.sceneCount, 2);
  assert.equal(report.actionSceneCount, 0);
  assert.equal(report.coverage, null);
});

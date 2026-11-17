import test from 'node:test';
import assert from 'node:assert/strict';
import { auditAnimationCompatibility } from '../src/animation-compatibility-audit.js';

const bodyRig = {
  schemaVersion: 1,
  characterId: 'Foxy',
  bones: [{ id: 'root', parentId: null }, { id: 'head', parentId: 'root' }],
  parts: [
    { id: 'body', boneId: 'root', imageUrl: 'https://assets.example/body.png' },
    { id: 'head-part', boneId: 'head', imageUrl: 'https://assets.example/head.png' }
  ]
};
const facialRig = {
  schemaVersion: 1,
  characterId: 'Foxy',
  headBoneId: 'head',
  parts: [{ id: 'mouth', role: 'mouth', imageUrl: 'https://assets.example/mouth.png', x: 0.5, y: 0.3, width: 0.1, height: 0.05 }]
};
const rigTimeline = {
  schemaVersion: 1,
  keyframes: [
    { time: 0, poses: { Foxy: { root: { rotation: 0 } } } },
    { time: 1, poses: { Foxy: { root: { rotation: 0.2 }, head: { rotation: 0.1 } } } }
  ]
};

test('accepts compatible body, facial and bone animation systems on the same character', () => {
  const report = auditAnimationCompatibility([{
    characterLayers: [{ characterId: 'Foxy', imageUrl: 'https://assets.example/foxy.png' }],
    characterRigs: [bodyRig],
    characterFacialRigs: [facialRig],
    characterRigTimeline: rigTimeline,
    characterFacialExpressions: { Foxy: { name: 'happy' } }
  }]);
  assert.equal(report.status, 'compatible-with-warnings');
  assert.equal(report.errorCount, 0);
  assert.ok(report.warningCount > 0, 'the minimal rig should disclose unsupported full-body preset details');
  assert.equal(report.presetCount, 10);
  assert.ok(report.issues.some(item => item.code === 'rig-preset-limited'));
  assert.equal(report.rigCount, 1);
  assert.equal(report.facialRigCount, 1);
  assert.equal(report.rigTimelineCount, 1);
});

test('rejects rig timelines that reference unknown characters or bones', () => {
  const report = auditAnimationCompatibility([{
    characterRigs: [bodyRig],
    characterRigTimeline: {
      schemaVersion: 1,
      keyframes: [
        { time: 0, poses: { Foxy: { root: { rotation: 0 } } } },
        { time: 1, poses: { Unknown: { root: { rotation: 0.1 } }, Foxy: { wing: { rotation: 0.2 } } } }
      ]
    }
  }]);
  assert.equal(report.status, 'incompatible');
  assert.ok(report.issues.some(item => item.code === 'timeline-character-rig-missing'));
  assert.ok(report.issues.some(item => item.code === 'timeline-bone-missing'));
});

test('detects facial head-bone mismatch and sprite motion suppressed by rig rendering', () => {
  const report = auditAnimationCompatibility([{
    characterLayers: [{ characterId: 'Foxy', imageUrl: 'https://assets.example/foxy.png' }],
    characterRigs: [bodyRig],
    characterFacialRigs: [{ ...facialRig, headBoneId: 'neck' }],
    characterMotionTimeline: {
      schemaVersion: 1,
      phases: [{ actorId: 'Foxy', start: 0, end: 1, motion: { to: { x: 0.8 } } }]
    }
  }]);
  assert.equal(report.status, 'incompatible');
  assert.ok(report.issues.some(item => item.code === 'facial-head-bone-unresolved'));
  assert.ok(report.issues.some(item => item.code === 'rig-suppresses-sprite-motion'));
});

test('detects action actors that cannot be rendered', () => {
  const evidence = 'Foxy waves at the visitor';
  const report = auditAnimationCompatibility([{
    characters: ['Foxy'],
    characterCastProvided: true,
    storyDetail: evidence,
    actionTimeline: {
      schemaVersion: 1,
      phases: [{ phase: 'action', start: 0, end: 1, actorId: 'Foxy', description: evidence, evidence }]
    }
  }]);
  assert.equal(report.status, 'incompatible');
  assert.ok(report.issues.some(item => item.code === 'action-actor-not-renderable'));
});

test('keeps sprite-only motion compatible when a matching layer exists', () => {
  const report = auditAnimationCompatibility([{
    characterLayers: [{ characterId: 'Foxy', imageUrl: 'https://assets.example/foxy.png' }],
    characterMotionTimeline: {
      schemaVersion: 1,
      phases: [{ actorId: 'Foxy', start: 0.1, end: 0.9, motion: { from: { x: 0.2 }, to: { x: 0.8 } } }]
    }
  }]);
  assert.equal(report.status, 'compatible');
});

test('checks dialogue cue timing and warns when visible speakers have no facial rig', () => {
  const report = auditAnimationCompatibility([{
    durationSeconds: 3,
    characterLayers: [{ characterId: 'Foxy', imageUrl: 'https://assets.example/foxy.png' }],
    voiceCues: [{ cueId: 'line-1', characterId: 'Foxy', characterName: 'Foxy', startFrame: 60, durationMs: 800 }]
  }]);
  assert.equal(report.status, 'compatible-with-warnings');
  assert.equal(report.voiceCueCount, 1);
  assert.ok(report.issues.some(item => item.code === 'voice-cue-facial-rig-missing'));
  assert.ok(report.issues.some(item => item.code === 'voice-cue-exceeds-scene'));
});

test('rejects malformed viseme timing in dialogue cues', () => {
  const report = auditAnimationCompatibility([{
    voiceCues: [{
      cueId: 'line-1', characterId: 'Narrator', characterName: 'Narrator',
      startFrame: 0, durationMs: 500,
      visemeEvents: [{ shape: 'invalid-mouth-shape', startMs: 0, durationMs: 120 }]
    }]
  }]);
  assert.equal(report.status, 'incompatible');
  assert.ok(report.issues.some(item => item.code === 'voice-viseme-timing-invalid'));
});

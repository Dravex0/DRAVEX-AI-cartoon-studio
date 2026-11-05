import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { auditCharacterActionPose } from '../src/animation-action-pose-audit.js';

const rig = () => ({
  schemaVersion: 1,
  characterId: 'Foxy',
  bones: [
    { id: 'root', parentId: null },
    { id: 'leftArm', parentId: 'root' },
    { id: 'rightArm', parentId: 'root' },
    { id: 'leftLeg', parentId: 'root' },
    { id: 'rightLeg', parentId: 'root' },
    { id: 'head', parentId: 'root' }
  ],
  parts: [
    { id: 'body', boneId: 'root', imageUrl: 'https://assets.example/body.png' },
    { id: 'arm-l', boneId: 'leftArm', imageUrl: 'https://assets.example/arm-l.png' },
    { id: 'arm-r', boneId: 'rightArm', imageUrl: 'https://assets.example/arm-r.png' },
    { id: 'leg-l', boneId: 'leftLeg', imageUrl: 'https://assets.example/leg-l.png' },
    { id: 'leg-r', boneId: 'rightLeg', imageUrl: 'https://assets.example/leg-r.png' },
    { id: 'head-part', boneId: 'head', imageUrl: 'https://assets.example/head.png' }
  ]
});

describe('action-specific character pose audit', () => {
  it('checks all nine supported action signatures against sampled generated poses', () => {
    const names = ['idle', 'walk', 'run', 'jump', 'dodge', 'wave', 'dance', 'attack', 'defend'];
    for (const name of names) {
      const report = auditCharacterActionPose(rig(), name);
      assert.equal(report.status, 'passed', name + ': ' + JSON.stringify(report.checks));
      assert.ok(report.checkCount > 0, name);
      assert.equal(report.failedCheckCount, 0, name);
      assert.match(report.limitation, /does not prove rendered pixels/);
    }
  });

  it('returns inconclusive instead of a false pass when required rig roles are absent', () => {
    const minimal = rig();
    minimal.bones = [{ id: 'root', parentId: null }];
    minimal.parts = [{ id: 'body', boneId: 'root', imageUrl: 'https://assets.example/body.png' }];
    const report = auditCharacterActionPose(minimal, 'walk');
    assert.equal(report.status, 'inconclusive');
    assert.ok(report.issues[0].missingRoles.includes('leftLeg'));
  });

  it('rejects an unsupported action preset explicitly', () => {
    const report = auditCharacterActionPose(rig(), 'teleport');
    assert.equal(report.status, 'failed');
    assert.equal(report.issues[0].code, 'action-preset-unsupported');
  });

  it('does not claim rendered or exported visual correctness', () => {
    const report = auditCharacterActionPose(rig(), 'attack');
    assert.match(report.limitation, /rendered pixels/);
    assert.match(report.limitation, /exported video/);
  });
});

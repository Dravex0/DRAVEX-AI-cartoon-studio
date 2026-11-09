import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCharacterRigAssetPlan } from '../src/character-rig-asset-plan.js';
import { auditCharacterRigJointGeometry } from '../src/character-rig-joint-audit.js';
import { assembleApprovedCharacterRig } from '../src/character-rig-part-review.js';

function makeRig() {
  const plan = buildCharacterRigAssetPlan({
    characterId: 'Foxy',
    appearanceReference: 'Orange fox, cream muzzle, green scarf'
  });
  return {
    ...plan.rig,
    parts: plan.rig.parts.map(part => ({
      ...part,
      imageUrl: 'https://assets.example/' + part.id + '.png'
    }))
  };
}

function makeApprovalInputs(rig) {
  const assets = rig.parts.map(part => ({
    partId: part.id,
    imageUrl: 'https://assets.example/' + part.id + '.png'
  }));
  const reviews = rig.parts.map(part => ({
    partId: part.id,
    review: {
      approved: true,
      transparency: { passed: true },
      decisions: {
        correctPart: true,
        characterIdentity: true,
        jointAlignment: true
      }
    }
  }));
  return { assets, reviews };
}

test('default ten-part rig has measurable overlap at all four limb joints', () => {
  const report = auditCharacterRigJointGeometry(makeRig());
  assert.equal(report.status, 'passed');
  assert.equal(report.passed, true);
  assert.equal(report.joints.length, 4);
  assert.ok(report.joints.every(joint => joint.overlapRatio >= 0.08));
  assert.equal(report.geometrySource, 'neutral-pose-axis-aligned-part-rectangles');
  assert.match(report.limitation, /does not inspect alpha pixels/);
});

test('detects a visible placement gap between upper arm and forearm', () => {
  const rig = makeRig();
  rig.parts.find(part => part.id === 'arm-left-lower').y = 0.95;
  const report = auditCharacterRigJointGeometry(rig);
  assert.equal(report.status, 'needs-correction');
  assert.ok(report.issues.some(issue =>
    issue.code === 'joint-geometry-gap' && issue.jointId === 'left-elbow'
  ));
});

test('requires both parts for every principal limb joint', () => {
  const rig = makeRig();
  rig.parts = rig.parts.filter(part => part.id !== 'leg-right-lower');
  const report = auditCharacterRigJointGeometry(rig);
  assert.ok(report.issues.some(issue =>
    issue.code === 'joint-part-missing' && issue.jointId === 'right-knee'
  ));
});

test('does not approve a complete asset set when its rig geometry contains a joint gap', () => {
  const rig = makeRig();
  rig.parts.find(part => part.id === 'leg-left-lower').y = 1.15;
  const { assets, reviews } = makeApprovalInputs(rig);
  const result = assembleApprovedCharacterRig({
    characterId: 'Foxy', rig, assets, reviews
  });
  assert.equal(result.status, 'blocked');
  assert.equal(result.readyForAnimation, false);
  assert.ok(result.issues.includes('joint-geometry-gap:left-knee'));
});

test('approves the template geometry only after all ten assets and reviews are supplied', () => {
  const rig = makeRig();
  const { assets, reviews } = makeApprovalInputs(rig);
  const result = assembleApprovedCharacterRig({
    characterId: 'Foxy', rig, assets, reviews
  });
  assert.equal(result.status, 'approved');
  assert.equal(result.readyForAnimation, true);
  assert.equal(result.approvedPartCount, 10);
  assert.equal(result.jointGeometry.passed, true);
});

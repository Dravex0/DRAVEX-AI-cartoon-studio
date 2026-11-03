import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCharacterRigAssetPlan } from '../src/character-rig-asset-plan.js';
import {
  CHARACTER_RIG_REQUIRED_PARTS,
  assembleApprovedCharacterRig,
  reviewCharacterRigPart
} from '../src/character-rig-part-review.js';

function imageData() {
  const data = new Uint8ClampedArray(100 * 4);
  for (let i = 0; i < 100; i++) data[i * 4 + 3] = i < 30 ? 0 : 255;
  return { data };
}

test('requires pixel transparency and all three explicit human review decisions', () => {
  const asset = { partId: 'head' };
  const incomplete = reviewCharacterRigPart(asset, imageData(), 10, 10, {
    correctPart: true,
    characterIdentity: true
  });
  assert.equal(incomplete.approved, false);
  assert.ok(incomplete.issues.includes('joint-alignment-not-confirmed'));

  const approved = reviewCharacterRigPart(asset, imageData(), 10, 10, {
    correctPart: true,
    characterIdentity: true,
    jointAlignment: true
  });
  assert.equal(approved.status, 'approved');
  assert.equal(approved.transparency.passed, true);
  assert.equal(approved.approved, true);
});

test('rejects opaque or blank images even when human review boxes are checked', () => {
  const opaque = { data: new Uint8ClampedArray(100 * 4).fill(255) };
  const result = reviewCharacterRigPart({ partId: 'torso' }, opaque, 10, 10, {
    correctPart: true, characterIdentity: true, jointAlignment: true
  });
  assert.equal(result.approved, false);
  assert.equal(result.status, 'rejected');
  assert.ok(result.issues.includes('transparency-check-failed'));
});

test('blocks assembly until every required part has an approved review', () => {
  const plan = buildCharacterRigAssetPlan({
    characterId: 'Foxy',
    appearanceReference: 'Orange fox, cream muzzle, green scarf'
  });
  const assets = plan.parts.map(part => ({
    partId: part.partId,
    imageUrl: 'https://images.example.test/' + part.partId + '.png'
  }));
  const reviews = CHARACTER_RIG_REQUIRED_PARTS.map(partId => ({
    partId,
    review: { approved: true, transparency: { passed: true }, decisions: { correctPart: true, characterIdentity: true, jointAlignment: true } }
  }));
  reviews.pop();
  const result = assembleApprovedCharacterRig({
    characterId: 'Foxy', rig: plan.rig, assets, reviews
  });
  assert.equal(result.status, 'blocked');
  assert.equal(result.readyForAnimation, false);
  assert.ok(result.issues.some(issue => issue === 'part-not-approved:leg-right-lower'));
});

test('assembles a complete reviewed rig with all ten HTTPS image bindings', () => {
  const plan = buildCharacterRigAssetPlan({
    characterId: 'Foxy',
    appearanceReference: 'Orange fox, cream muzzle, green scarf'
  });
  const assets = plan.parts.map(part => ({
    partId: part.partId,
    imageUrl: 'https://images.example.test/' + part.partId + '.png'
  }));
  const reviews = CHARACTER_RIG_REQUIRED_PARTS.map(partId => ({
    partId, review: { approved: true, transparency: { passed: true }, decisions: { correctPart: true, characterIdentity: true, jointAlignment: true } }
  }));
  const result = assembleApprovedCharacterRig({
    characterId: 'Foxy', rig: plan.rig, assets, reviews
  });
  assert.equal(result.status, 'approved');
  assert.equal(result.readyForAnimation, true);
  assert.equal(result.approvedPartCount, 10);
  assert.ok(result.rig.parts.every(part => part.imageUrl.startsWith('https://')));
});

test('does not trust an approval flag without transparency proof and all human decisions', () => {
  const plan = buildCharacterRigAssetPlan({ characterId: 'Foxy', appearanceReference: 'Orange fox' });
  const assets = plan.parts.map(part => ({ partId: part.partId, imageUrl: 'https://images.example.test/' + part.partId + '.png' }));
  const reviews = CHARACTER_RIG_REQUIRED_PARTS.map(partId => ({
    partId, review: { approved: true }
  }));
  const result = assembleApprovedCharacterRig({ characterId: 'Foxy', rig: plan.rig, assets, reviews });
  assert.equal(result.status, 'blocked');
  assert.ok(result.issues.includes('part-not-approved:torso'));
});

test('rejects duplicate or missing part assets and malformed input', () => {
  const plan = buildCharacterRigAssetPlan({
    characterId: 'Foxy',
    appearanceReference: 'Orange fox'
  });
  const reviews = CHARACTER_RIG_REQUIRED_PARTS.map(partId => ({ partId, review: { approved: true, transparency: { passed: true }, decisions: { correctPart: true, characterIdentity: true, jointAlignment: true } } }));
  const assets = plan.parts.map(part => ({
    partId: part.partId,
    imageUrl: 'https://images.example.test/' + part.partId + '.png'
  }));
  assets[1] = { ...assets[0] };
  const result = assembleApprovedCharacterRig({
    characterId: 'Foxy', rig: plan.rig, assets, reviews
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.issues.includes('missing-or-duplicate-part-id'));
  assert.equal(assembleApprovedCharacterRig({}).status, 'blocked');
});

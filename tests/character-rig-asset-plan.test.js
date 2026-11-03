import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCharacterRigAssetPlan, CHARACTER_RIG_ASSET_PART_COUNT } from '../src/character-rig-asset-plan.js';
import { validateCharacterRig } from '../src/character-rig.js';

test('creates a stable ten-part character asset plan and unbound rig scaffold', () => {
  const input = { characterId: 'Foxy', appearanceReference: 'Orange fox, cream muzzle, green scarf' };
  const first = buildCharacterRigAssetPlan(input);
  const second = buildCharacterRigAssetPlan(input);
  assert.equal(first.status, 'ready_for_generation');
  assert.equal(first.parts.length, CHARACTER_RIG_ASSET_PART_COUNT);
  assert.equal(first.parts.length, 10);
  assert.equal(first.identitySeed, second.identitySeed);
  assert.deepEqual(first.parts.map(part => part.assetId), second.parts.map(part => part.assetId));
  assert.ok(first.parts.every(part => part.identitySeed === first.identitySeed));
  assert.ok(first.parts.every(part => part.prompt.includes(input.appearanceReference)));
  assert.ok(first.parts.every(part => part.prompt.includes('Transparent alpha background')));
  assert.equal(first.rig.parts.length, 10);
  assert.equal(validateCharacterRig(first.rig).passed, false, 'image URLs must be bound before the rig can be used');
});

test('accepts an explicit valid seed without changing the character identity', () => {
  const result = buildCharacterRigAssetPlan({
    characterId: 'Foxy', appearanceReference: 'Orange fox', identitySeed: 123456
  });
  assert.equal(result.identitySeed, 123456);
  assert.ok(result.parts.every(part => part.identitySeed === 123456));
});

test('blocks incomplete character references instead of inventing appearance', () => {
  const noId = buildCharacterRigAssetPlan({ appearanceReference: 'Blue robot' });
  const noAppearance = buildCharacterRigAssetPlan({ characterId: 'Robot' });
  assert.equal(noId.status, 'blocked');
  assert.deepEqual(noId.issues, ['character-id-missing']);
  assert.equal(noAppearance.status, 'blocked');
  assert.deepEqual(noAppearance.issues, ['appearance-reference-missing']);
  assert.equal(noId.rig, null);
});

test('rejects invalid seeds and deterministically derives a safe seed', () => {
  const result = buildCharacterRigAssetPlan({
    characterId: 'Fox', appearanceReference: 'Orange fox', identitySeed: -1
  });
  assert.ok(Number.isInteger(result.identitySeed));
  assert.ok(result.identitySeed >= 0 && result.identitySeed <= 0xffffffff);
});

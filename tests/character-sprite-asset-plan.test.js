import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCharacterSpriteAssetPlan, CHARACTER_SPRITE_SCENE_LIMIT } from '../src/character-sprite-asset-plan.js';

const bible = [
  { characterId: 'Foxy', species: 'Anthropomorphic fox', visualDescription: 'Small orange fox', clothing: 'Blue scarf', distinctiveFeatures: 'White tail tip' },
  { characterId: 'Bird', species: 'Small yellow bird', visualDescription: 'Round body and short wings', clothing: 'Red cap' }
];

test('creates one sprite plan per cast member using canonical character appearance', () => {
  const plan = buildCharacterSpriteAssetPlan({
    id: 'scene-1', characters: ['foxy'],
    visibleAction: 'Foxy waves.',
    location: 'Forest clearing', timeOfDay: 'Morning'
  }, bible);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].characterId, 'foxy');
  assert.equal(plan[0].status, 'ready');
  assert.equal(plan[0].planningStatus, 'ready');
  assert.equal(plan[0].generationStatus, 'not_started');
  assert.equal(plan[0].verificationStatus, 'not_verified');
  assert.match(plan[0].prompt, /Small orange fox/);
  assert.match(plan[0].prompt, /Blue scarf/);
  assert.match(plan[0].prompt, /Foxy waves/);
  assert.match(plan[0].prompt, /Transparent background/);
});

test('assigns actor-specific timeline actions instead of sharing another character action', () => {
  const plan = buildCharacterSpriteAssetPlan({
    id: 'scene-2',
    storyDetail: 'Foxy notices the door, opens the wooden door, and Bird steps back in surprise and watches the open doorway.',
    characters: ['Foxy', 'Bird'],
    visibleAction: 'Foxy opens the door while Bird waits.',
    actionTimeline: {
      schemaVersion: 1,
      phases: [
        { phase: 'preparation', start: 0, end: 0.15, actorId: 'Foxy', description: 'Foxy notices the door.', evidence: 'Foxy notices the door' },
        { phase: 'action', start: 0.15, end: 0.55, actorId: 'Foxy', description: 'Foxy opens the wooden door.', evidence: 'opens the wooden door' },
        { phase: 'reaction', start: 0.55, end: 0.8, actorId: 'Bird', description: 'Bird steps back in surprise.', evidence: 'Bird steps back in surprise' },
        { phase: 'result', start: 0.8, end: 1, actorId: 'Bird', description: 'Bird watches the open doorway.', evidence: 'open doorway' }
      ]
    }
  }, bible);
  assert.equal(plan[0].action, 'Foxy notices the door. Foxy opens the wooden door.');
  assert.equal(plan[1].action, 'Bird steps back in surprise. Bird watches the open doorway.');
  assert.equal(plan.every(item => item.status === 'ready'), true);
});

test('blocks missing and empty character references without inventing appearance', () => {
  const plan = buildCharacterSpriteAssetPlan({
    id: 'scene-3', characters: ['Unknown', 'Empty'], visibleAction: 'They stand still.'
  }, [{ characterId: 'Empty' }]);
  assert.equal(plan[0].status, 'blocked');
  assert.equal(plan[0].planningStatus, 'blocked');
  assert.equal(plan[0].appearanceReference, '');
  assert.equal(plan[0].prompt, '');
  assert.ok(plan[0].issues.some(issue => issue.code === 'missing-character-reference'));
  assert.equal(plan[1].status, 'blocked');
  assert.ok(plan[1].issues.some(issue => issue.code === 'empty-character-appearance'));
});

test('uses neutral sprite poses rather than inventing a shared action for multiple characters', () => {
  const plan = buildCharacterSpriteAssetPlan({
    characters: ['Foxy', 'Bird'], visibleAction: 'They move together.'
  }, bible);
  assert.equal(plan.every(item => item.status === 'ready'), true);
  assert.equal(plan.every(item => item.actionStatus === 'neutral-fallback'), true);
  assert.ok(plan.every(item => item.action.includes('Neutral full-body standing pose')));
  assert.ok(plan.every(item => !item.action.includes('They move together')));
});

test('uses a neutral pose for a cast member omitted from an otherwise valid actor timeline', () => {
  const plan = buildCharacterSpriteAssetPlan({
    id: 'scene-4',
    characters: ['Foxy', 'Bird'],
    storyDetail: 'Foxy waves to Bird.',
    actionTimeline: {
      schemaVersion: 1,
      phases: [
        { phase: 'action', start: 0, end: 0.6, actorId: 'Foxy', description: 'Foxy waves to Bird.', evidence: 'Foxy waves to Bird.' }
      ]
    }
  }, bible);
  assert.equal(plan[0].actionStatus, 'grounded');
  assert.equal(plan[1].actionStatus, 'neutral-fallback');
  assert.ok(plan[1].action.includes('Neutral full-body standing pose'));
});

test('deduplicates IDs case-insensitively and enforces the scene cast limit', () => {
  const cast = Array.from({ length: CHARACTER_SPRITE_SCENE_LIMIT + 2 }, (_, i) => `Character-${i}`);
  const plan = buildCharacterSpriteAssetPlan({
    characters: ['Foxy', 'foxy', ...cast],
    visibleAction: 'One character performs the action.'
  }, [...bible, ...cast.map(characterId => ({ characterId, visualDescription: 'A distinct character' }))]);
  assert.equal(plan.length, CHARACTER_SPRITE_SCENE_LIMIT);
  assert.equal(plan.filter(item => item.characterId.toLowerCase() === 'foxy').length, 1);
  assert.deepEqual(plan.map(item => item.order), plan.map((_, index) => index));
});

test('returns an empty plan for scenes without a cast', () => {
  assert.deepEqual(buildCharacterSpriteAssetPlan({ characters: [] }, bible), []);
});


test('keeps a stable identity seed across scenes while preserving scene-specific sprite IDs', () => {
  const first = buildCharacterSpriteAssetPlan({
    id: 'scene-1', characters: ['Foxy'], visibleAction: 'Foxy waves.'
  }, bible)[0];
  const second = buildCharacterSpriteAssetPlan({
    id: 'scene-9', characters: ['foxy'], visibleAction: 'Foxy runs through the forest.'
  }, bible)[0];
  assert.equal(first.identitySeed, second.identitySeed);
  assert.notEqual(first.assetId, second.assetId);
  assert.ok(Number.isInteger(first.identitySeed));
  assert.ok(first.identitySeed >= 0 && first.identitySeed <= 0xffffffff);
});

test('changes the identity seed when the canonical appearance changes', () => {
  const original = buildCharacterSpriteAssetPlan({
    id: 'scene-1', characters: ['Foxy'], visibleAction: 'Foxy waves.'
  }, bible)[0];
  const redesigned = buildCharacterSpriteAssetPlan({
    id: 'scene-1', characters: ['Foxy'], visibleAction: 'Foxy waves.'
  }, [{ ...bible[0], clothing: 'Green coat' }])[0];
  assert.notEqual(original.identitySeed, redesigned.identitySeed);
});

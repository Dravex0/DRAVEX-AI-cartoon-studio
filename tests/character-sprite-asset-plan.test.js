import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCharacterSpriteAssetPlan, isCurrentCharacterSpriteAsset, CHARACTER_SPRITE_SCENE_LIMIT } from '../src/character-sprite-asset-plan.js';
import { buildCharacterSpriteBatchPlan, mergeCharacterSpriteSceneOverrides } from '../src/character-sprite-batch-plan.js';

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

test('does not assign a shared action to multiple characters without actor evidence', () => {
  const plan = buildCharacterSpriteAssetPlan({
    characters: ['Foxy', 'Bird'], visibleAction: 'They move together.'
  }, bible);
  assert.equal(plan.every(item => item.action === '' && item.status === 'blocked'), true);
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

test('builds sprite plans for every scene and preserves scene-specific actions', () => {
  const scenes = [
    { id: 'scene-a', characters: ['Foxy'], visibleAction: 'Foxy waves.' },
    { id: 'scene-b', characters: ['Foxy'], visibleAction: 'Foxy runs.' }
  ];
  const batch = buildCharacterSpriteBatchPlan(scenes, bible);
  assert.equal(batch.length, 2);
  assert.equal(batch[0].plans[0].sceneId, 'scene-a');
  assert.match(batch[0].plans[0].action, /waves/);
  assert.match(batch[1].plans[0].action, /runs/);
  assert.notEqual(batch[0].plans[0].assetId, batch[1].plans[0].assetId);
  assert.equal(batch[0].plans[0].identitySeed, batch[1].plans[0].identitySeed);
});

test('applies unsaved editor overrides only to the currently open scene', () => {
  const scenes = [
    { id: 'scene-a', characters: ['Foxy'], visibleAction: 'Saved action A.' },
    { id: 'scene-b', characters: ['Bird'], visibleAction: 'Saved action B.' }
  ];
  const batch = buildCharacterSpriteBatchPlan(scenes, bible, {
    currentSceneIndex: 1,
    currentSceneOverrides: { characters: ['Foxy'], visibleAction: 'Unsaved action B.' }
  });
  assert.equal(batch[0].plans[0].characterId, 'Foxy');
  assert.match(batch[0].plans[0].action, /Saved action A/);
  assert.equal(batch[1].plans[0].characterId, 'Foxy');
  assert.match(batch[1].plans[0].action, /Unsaved action B/);
  assert.equal(scenes[1].characters[0], 'Bird');
});

test('keeps scenes without cast out of the batch and returns no plans for invalid input', () => {
  assert.deepEqual(buildCharacterSpriteBatchPlan([{ id: 'empty', characters: [] }], bible), []);
  assert.deepEqual(buildCharacterSpriteBatchPlan(null, bible), []);
});

test('uses saved motion prompts as scene actions when no explicit visibleAction exists', () => {
  const batch = buildCharacterSpriteBatchPlan([
    { id: 'scene-motion', characters: ['Foxy'], motionPrompt: 'Foxy jumps over a log.' }
  ], bible);
  assert.equal(batch[0].plans[0].status, 'ready');
  assert.match(batch[0].plans[0].action, /jumps over a log/);
});


test('merges sprite editor overrides into a scene snapshot and synchronizes the canonical image prompt', () => {
  const saved = {
    id: 'scene-edit',
    title: 'Saved title',
    prompt: 'Saved image prompt',
    imagePrompt: 'Saved image prompt',
    motionPrompt: 'Saved action',
    visibleAction: 'Saved action',
    characters: ['Bird']
  };
  const updated = mergeCharacterSpriteSceneOverrides(saved, {
    title: 'Edited title',
    imagePrompt: 'Edited image prompt',
    motionPrompt: 'Foxy jumps.',
    visibleAction: 'Foxy jumps.',
    characters: ['Foxy']
  });
  assert.equal(updated.title, 'Edited title');
  assert.equal(updated.prompt, 'Edited image prompt');
  assert.equal(updated.imagePrompt, 'Edited image prompt');
  assert.equal(updated.visibleAction, 'Foxy jumps.');
  assert.deepEqual(updated.characters, ['Foxy']);
  assert.equal(saved.title, 'Saved title');
  assert.equal(saved.prompt, 'Saved image prompt');
  assert.deepEqual(saved.characters, ['Bird']);
});


test('changes a scene sprite asset ID when the character action changes but keeps the identity seed', () => {
  const waving = buildCharacterSpriteAssetPlan({
    id: 'scene-action',
    characters: ['Foxy'],
    visibleAction: 'Foxy waves to the camera.'
  }, bible)[0];
  const running = buildCharacterSpriteAssetPlan({
    id: 'scene-action',
    characters: ['Foxy'],
    visibleAction: 'Foxy runs toward the gate.'
  }, bible)[0];
  const repeated = buildCharacterSpriteAssetPlan({
    id: 'scene-action',
    characters: ['Foxy'],
    visibleAction: 'Foxy waves to the camera.'
  }, bible)[0];

  assert.notEqual(waving.assetId, running.assetId);
  assert.equal(waving.assetId, repeated.assetId);
  assert.equal(waving.identitySeed, running.identitySeed);
});

test('changes a scene sprite asset ID when canonical character appearance changes', () => {
  const original = buildCharacterSpriteAssetPlan({
    id: 'scene-appearance',
    characters: ['Foxy'],
    visibleAction: 'Foxy waves.'
  }, bible)[0];
  const redesigned = buildCharacterSpriteAssetPlan({
    id: 'scene-appearance',
    characters: ['Foxy'],
    visibleAction: 'Foxy waves.'
  }, [{ ...bible[0], clothing: 'Green coat' }])[0];

  assert.notEqual(original.assetId, redesigned.assetId);
  assert.notEqual(original.identitySeed, redesigned.identitySeed);
  assert.ok(original.assetId.length <= 240);
});


test('includes long canonical appearance fields in the sprite fingerprint and identity seed', () => {
  const longDescription = 'A'.repeat(160);
  const first = buildCharacterSpriteAssetPlan({
    id: 'scene-long-appearance',
    characters: ['Foxy'],
    visibleAction: 'Foxy waves.'
  }, [{ ...bible[0], visualDescription: longDescription + ' red markings' }])[0];
  const changed = buildCharacterSpriteAssetPlan({
    id: 'scene-long-appearance',
    characters: ['Foxy'],
    visibleAction: 'Foxy waves.'
  }, [{ ...bible[0], visualDescription: longDescription + ' blue markings' }])[0];

  assert.notEqual(first.assetId, changed.assetId);
  assert.notEqual(first.identitySeed, changed.identitySeed);
});


test('rejects stored sprite assets when the scene action or canonical appearance has changed', () => {
  const scene = { id: 'scene-currentness', characters: ['Foxy'], visibleAction: 'Foxy waves.' };
  const asset = { assetId: buildCharacterSpriteAssetPlan(scene, bible)[0].assetId };
  assert.equal(isCurrentCharacterSpriteAsset(scene, bible, asset), true);
  assert.equal(isCurrentCharacterSpriteAsset({ ...scene, visibleAction: 'Foxy runs.' }, bible, asset), false);
  assert.equal(isCurrentCharacterSpriteAsset(scene, [{ ...bible[0], clothing: 'Green coat' }, bible[1]], asset), false);
  assert.equal(isCurrentCharacterSpriteAsset(scene, [], asset), false);
});


test('uses a saved motion prompt as the current action when visibleAction is absent', () => {
  const scene = { id: 'scene-motion-current', characters: ['Foxy'], motionPrompt: 'Foxy jumps over a log.' };
  const plan = buildCharacterSpriteAssetPlan(scene, bible)[0];
  assert.equal(plan.status, 'ready');
  assert.match(plan.action, /jumps over a log/);
  assert.equal(isCurrentCharacterSpriteAsset(scene, bible, { assetId: plan.assetId }), true);
});

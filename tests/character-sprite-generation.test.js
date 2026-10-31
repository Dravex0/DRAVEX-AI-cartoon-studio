import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCharacterSpriteAsset } from '../src/character-sprite-generation.js';

const plan = {
  assetId: 'scene-1:Foxy',
  sceneId: 'scene-1',
  characterId: 'Foxy',
  prompt: 'An isolated full-body orange fox sprite.',
  negativePrompt: 'background, text',
  status: 'ready'
};

test('requires a separate explicit sprite consent before contacting a provider', async () => {
  let called = false;
  await assert.rejects(() => generateCharacterSpriteAsset({
    plan, generateImage: async () => { called = true; return { imageUrl: 'https://cdn.example.test/a.png' }; }
  }), /Explicit character-sprite prompt consent/);
  assert.equal(called, false);
});

test('does not send blocked or incomplete plans even after consent', async () => {
  let called = false;
  await assert.rejects(() => generateCharacterSpriteAsset({
    plan: { ...plan, status: 'blocked' }, consentAccepted: true,
    generateImage: async () => { called = true; return { imageUrl: 'https://cdn.example.test/a.png' }; }
  }), /blocked or incomplete/);
  assert.equal(called, false);
});

test('binds a generated HTTPS image to the exact stable character and asset IDs', async () => {
  const received = [];
  const asset = await generateCharacterSpriteAsset({
    plan, consentAccepted: true,
    generateImage: async options => {
      received.push(options);
      return { imageUrl: 'https://cdn.example.test/foxy.png', requestId: 'req-1', seed: '42', model: 'model-a' };
    }
  });
  assert.equal(received.length, 1);
  assert.equal(received[0].prompt, plan.prompt);
  assert.equal(received[0].negativePrompt, plan.negativePrompt);
  assert.deepEqual({
    assetId: asset.assetId, sceneId: asset.sceneId, characterId: asset.characterId,
    assetRole: asset.assetRole, imageUrl: asset.imageUrl, provider: asset.provider,
    requestId: asset.requestId, seed: asset.seed, model: asset.model,
    generationStatus: asset.generationStatus, verificationStatus: asset.verificationStatus,
    transparencyStatus: asset.transparencyStatus
  }, {
    assetId: 'scene-1:Foxy', sceneId: 'scene-1', characterId: 'Foxy',
    assetRole: 'character-sprite', imageUrl: 'https://cdn.example.test/foxy.png',
    provider: 'ai-horde', requestId: 'req-1', seed: '42', model: 'model-a',
    generationStatus: 'generated', verificationStatus: 'not_verified',
    transparencyStatus: 'unverified'
  });
  assert.ok(Number.isFinite(Date.parse(asset.generatedAt)));
});

test('rejects non-HTTPS provider results rather than storing unsafe image references', async () => {
  await assert.rejects(() => generateCharacterSpriteAsset({
    plan, consentAccepted: true,
    generateImage: async () => ({ imageUrl: 'http://cdn.example.test/foxy.png' })
  }), /unsupported image URL/);
});

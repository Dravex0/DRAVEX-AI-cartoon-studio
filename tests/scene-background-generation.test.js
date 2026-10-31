import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSceneBackgroundAsset } from '../src/scene-background-generation.js';

const plan = {
  ready: true,
  assetRole: 'scene-background',
  prompt: 'A quiet moonlit forest clearing. Environment only.'
};

test('requires explicit consent before calling the image provider', async () => {
  let calls = 0;
  await assert.rejects(
    generateSceneBackgroundAsset({ plan, consentAccepted: false, generateImage: async () => { calls++; } }),
    /Explicit scene-background prompt consent/
  );
  assert.equal(calls, 0);
});

test('rejects incomplete or character-aware plans before provider invocation', async () => {
  let calls = 0;
  for (const invalid of [null, {}, { ...plan, ready: false }, { ...plan, assetRole: 'character-sprite' }, { ...plan, prompt: '' }]) {
    await assert.rejects(
      generateSceneBackgroundAsset({ plan: invalid, consentAccepted: true, generateImage: async () => { calls++; } }),
      /ready scene-background prompt plan/
    );
  }
  assert.equal(calls, 0);
});

test('generates one environment plate and marks its composition unverified', async () => {
  let request;
  const asset = await generateSceneBackgroundAsset({
    plan,
    sceneId: 'scene-7',
    consentAccepted: true,
    generateImage: async options => {
      request = options;
      return { imageUrl: 'https://images.example/background.png', requestId: 'req-7', seed: '42', model: 'test-model' };
    }
  });
  assert.equal(request.prompt, plan.prompt);
  assert.match(request.negativePrompt, /characters/);
  assert.equal(request.width, 768);
  assert.equal(asset.sceneId, 'scene-7');
  assert.equal(asset.assetRole, 'scene-background');
  assert.equal(asset.imageUrl, 'https://images.example/background.png');
  assert.equal(asset.requestId, 'req-7');
  assert.equal(asset.compositionStatus, 'unverified');
});

test('rejects non-HTTPS provider results', async () => {
  await assert.rejects(
    generateSceneBackgroundAsset({
      plan,
      consentAccepted: true,
      generateImage: async () => ({ imageUrl: 'http://images.example/background.png' })
    }),
    /unsupported background image URL/
  );
});

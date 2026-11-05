import test from 'node:test';
import assert from 'node:assert/strict';
import { createUniversalImageGenerationCapability } from '../src/universal-image-generation-capability.js';

const plan = { sourceRequest: 'Create a complete video film' };
const step = { requiredCapabilities: ['image.generate.horde'], inputs: ['allScenes'] };
const scenes = () => [
  { id: 's1', title: 'First scene', description: 'A sunrise' },
  { id: 's2', title: 'Second scene', description: 'A river' },
  { id: 's3', title: 'Third scene', description: 'A forest', generatedImageUrl: 'https://images.example/ready.png' }
];

test('registers a remote AI Horde capability with a separate consent scope', () => {
  const capability = createUniversalImageGenerationCapability({
    getScenes: scenes,
    generateSceneImage: async () => ({ imageUrl: 'https://images.example/new.png' }),
    onSceneGenerated: async () => {}
  });
  assert.equal(capability.id, 'image.generate.horde');
  assert.equal(capability.privacy, 'remote');
  assert.equal(capability.consentKey, 'ai-horde-image');
  assert.equal(capability.isAvailable(), true);
});

test('generates only missing scene images sequentially and preserves existing images', async () => {
  const current = scenes();
  const order = [];
  const capability = createUniversalImageGenerationCapability({
    getScenes: () => current,
    generateSceneImage: async ({ scene }) => {
      order.push(scene.id);
      return { imageUrl: 'https://images.example/' + scene.id + '.png', seed: '42', shared: true };
    },
    onSceneGenerated: async ({ scene, result }) => {
      const index = current.findIndex(item => item.id === scene.id);
      current[index] = { ...current[index], generatedImageUrl: result.imageUrl };
    }
  });
  const result = await capability.run({ plan, step });
  assert.deepEqual(order, ['s1', 's2']);
  assert.equal(result.imageCount, 2);
  assert.equal(current[2].generatedImageUrl, 'https://images.example/ready.png');
  assert.equal(current.every(scene => Boolean(scene.generatedImageUrl)), true);
});

test('does not overwrite an existing scene image', async () => {
  const current = [{ id: 's1', title: 'Already ready', generatedImageUrl: 'https://images.example/old.png' }];
  let calls = 0;
  const capability = createUniversalImageGenerationCapability({
    getScenes: () => current,
    generateSceneImage: async () => { calls += 1; return { imageUrl: 'https://images.example/new.png' }; },
    onSceneGenerated: async () => {}
  });
  assert.equal(capability.isAvailable(), false);
  const resumeStep = { requiredCapabilities: ['image.generate.horde'], inputs: ['allScenes'] };
  assert.equal(capability.isAvailable({ step: resumeStep }), true);
  const result = await capability.run({ plan, step: resumeStep });
  assert.equal(result.alreadyReady, true);
  assert.equal(result.imageCount, 0);
  assert.equal(calls, 0);
});

test('rejects stale output when a scene changes while generation is queued', async () => {
  const current = [{ id: 's1', title: 'Original scene' }];
  const capability = createUniversalImageGenerationCapability({
    getScenes: () => current,
    generateSceneImage: async () => {
      current[0] = { ...current[0], title: 'Edited while queued' };
      return { imageUrl: 'https://images.example/stale.png' };
    },
    onSceneGenerated: async () => { throw new Error('must not attach stale output'); }
  });
  await assert.rejects(capability.run({
    plan, step: { requiredCapabilities: ['image.generate.horde'], inputs: ['allScenes'] }
  }), /changed while AI Horde was working/);
});

test('rejects non-HTTPS image results and invalid capability binding', async () => {
  const current = [{ id: 's1', title: 'Scene' }];
  const capability = createUniversalImageGenerationCapability({
    getScenes: () => current,
    generateSceneImage: async () => ({ imageUrl: 'data:image/png;base64,AAAA' }),
    onSceneGenerated: async () => {}
  });
  await assert.rejects(capability.run({ plan, step: { requiredCapabilities: ['video.generate.local'] } }), {
    code: 'CAPABILITY_BINDING_MISMATCH'
  });
  await assert.rejects(capability.run({
    plan, step: { requiredCapabilities: ['image.generate.horde'], inputs: ['allScenes'] }
  }), { code: 'INVALID_SCENE_IMAGE' });
});

test('honours cancellation before generating the next scene', async () => {
  const current = scenes();
  const controller = new AbortController();
  let calls = 0;
  const capability = createUniversalImageGenerationCapability({
    getScenes: () => current,
    generateSceneImage: async ({ scene }) => {
      calls += 1;
      if (scene.id === 's1') controller.abort();
      return { imageUrl: 'https://images.example/' + scene.id + '.png' };
    },
    onSceneGenerated: async ({ scene, result }) => {
      const index = current.findIndex(item => item.id === scene.id);
      current[index] = { ...current[index], generatedImageUrl: result.imageUrl };
    }
  });
  await assert.rejects(capability.run({ plan, step, signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 1);
});

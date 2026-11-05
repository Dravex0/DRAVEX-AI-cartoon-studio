import test from 'node:test';
import assert from 'node:assert/strict';
import { createUniversalRemoteVideoCapability } from '../src/universal-remote-video-capability.js';

const validContext = {
  plan: { sourceRequest: 'Create a video clip' },
  step: { requiredCapabilities: ['video.generate.remote'] }
};

test('remote video capability requires consent before invoking generator', async () => {
  let calls = 0;
  const adapter = createUniversalRemoteVideoCapability({
    hasConsent: () => false,
    isAvailable: () => true,
    generateScene: async () => { calls += 1; return { status: 'completed', sceneId: 's1', filename: 'clip.mp4', size: 10 }; }
  });
  await assert.rejects(adapter.run(validContext), error => error.code === 'REMOTE_CONSENT_REQUIRED');
  assert.equal(calls, 0);
});

test('remote video capability checks request, exact binding and verified artifact', async () => {
  let calls = 0;
  const adapter = createUniversalRemoteVideoCapability({
    hasConsent: () => true,
    isAvailable: () => true,
    generateScene: async () => { calls += 1; return { status: 'completed', sceneId: 's1', filename: 'clip.mp4', size: 10 }; }
  });
  await assert.rejects(adapter.run({ ...validContext, plan: { sourceRequest: 'Make a poster' } }), error => error.code === 'CAPABILITY_REQUEST_MISMATCH');
  await assert.rejects(adapter.run({ ...validContext, step: { requiredCapabilities: ['video.generate.local'] } }), error => error.code === 'CAPABILITY_BINDING_MISMATCH');
  assert.equal(calls, 0);
  const result = await adapter.run(validContext);
  assert.equal(result.provider, 'huggingface-wan22');
  assert.equal(result.size, 10);
  assert.equal(calls, 1);
});

test('remote video capability stops when cancelled and blocks unavailable setup', async () => {
  const adapter = createUniversalRemoteVideoCapability({
    hasConsent: () => true,
    isAvailable: () => false,
    generateScene: async () => { throw new Error('must not run'); }
  });
  await assert.rejects(adapter.run(validContext), error => error.code === 'CAPABILITY_UNAVAILABLE');
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(adapter.run({ ...validContext, signal: controller.signal }), error => error.name === 'AbortError');
});

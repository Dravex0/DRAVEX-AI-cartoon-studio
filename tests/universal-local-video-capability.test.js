import test from 'node:test';
import assert from 'node:assert/strict';
import { createUniversalLocalVideoCapability } from '../src/universal-local-video-capability.js';

const plan = { sourceRequest: 'Create a video scene' };
const step = { id: 'video', requiredCapabilities: ['video.generate.local'] };

test('runs the injected local scene-video workflow and returns a checkpoint-safe artifact', async () => {
  const progress = [];
  const adapter = createUniversalLocalVideoCapability({
    isAvailable: () => true,
    generateScene: async ({ signal, reportProgress }) => {
      assert.equal(signal.aborted, false);
      reportProgress('provider processing');
      return { status: 'completed', sceneId: 'scene-1', filename: 'scene.mp4', mimeType: 'video/mp4', size: 1234, persisted: true, video: new Blob(['not returned']) };
    }
  });
  const result = await adapter.run({ plan, step, signal: new AbortController().signal, reportProgress: value => progress.push(value) });
  assert.deepEqual(result, { type: 'scene-video', sceneId: 'scene-1', filename: 'scene.mp4', mimeType: 'video/mp4', size: 1234, persisted: true });
  assert.equal('video' in result, false);
  assert.deepEqual(progress, ['Starting local scene video generation', 'provider processing']);
});

test('blocks unavailable local generation before invoking the provider', async () => {
  let calls = 0;
  const adapter = createUniversalLocalVideoCapability({ isAvailable: () => false, generateScene: async () => { calls += 1; } });
  await assert.rejects(adapter.run({ plan, step }), error => error.code === 'CAPABILITY_UNAVAILABLE');
  assert.equal(calls, 0);
});

test('rejects unrelated requests and capability-binding mismatches', async () => {
  const adapter = createUniversalLocalVideoCapability({ isAvailable: () => true, generateScene: async () => ({ status: 'completed', sceneId: 's', filename: 's.mp4', size: 1 }) });
  await assert.rejects(adapter.run({ plan: { sourceRequest: 'Write a poem' }, step }), error => error.code === 'CAPABILITY_REQUEST_MISMATCH');
  await assert.rejects(adapter.run({ plan, step: { ...step, requiredCapabilities: ['video.generate.remote'] } }), error => error.code === 'CAPABILITY_BINDING_MISMATCH');
});

test('rejects missing or unverified video artifacts', async () => {
  const adapter = createUniversalLocalVideoCapability({ isAvailable: () => true, generateScene: async () => ({ status: 'completed', sceneId: 's', filename: 's.mp4', size: 0 }) });
  await assert.rejects(adapter.run({ plan, step }), error => error.code === 'INVALID_VIDEO_ARTIFACT');
});

test('honours cancellation before and after generation', async () => {
  const before = new AbortController();
  before.abort();
  const adapter = createUniversalLocalVideoCapability({ isAvailable: () => true, generateScene: async () => ({ status: 'completed', sceneId: 's', filename: 's.mp4', size: 1 }) });
  await assert.rejects(adapter.run({ plan, step, signal: before.signal }), error => error.name === 'AbortError');
  const after = new AbortController();
  const racing = createUniversalLocalVideoCapability({
    isAvailable: () => true,
    generateScene: async () => { after.abort(); return { status: 'completed', sceneId: 's', filename: 's.mp4', size: 1 }; }
  });
  await assert.rejects(racing.run({ plan, step, signal: after.signal }), error => error.name === 'AbortError');
});

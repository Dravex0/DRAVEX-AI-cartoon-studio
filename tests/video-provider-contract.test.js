import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVideoProviderRegistry,
  generateVideoWithProvider,
  validateVideoGenerationRequest
} from '../src/video-provider-contract.js';

const validRequest = {
  taskType: 'image-to-video',
  prompt: 'A fox turns a key and opens an ancient gate.',
  image: { type: 'image/png' },
  durationSeconds: 4,
  fps: 24,
  aspectRatio: '9:16'
};

test('validates image-to-video requests and applies safe defaults', () => {
  const result = validateVideoGenerationRequest(validRequest);
  assert.equal(result.valid, true);
  assert.equal(result.value.fps, 24);
  assert.equal(result.value.aspectRatio, '9:16');
  assert.equal(result.value.negativePrompt, '');
});

test('rejects missing prompt, image, invalid duration and frame rate', () => {
  const result = validateVideoGenerationRequest({
    taskType: 'image-to-video',
    durationSeconds: 99,
    fps: 120
  });
  assert.equal(result.valid, false);
  assert.deepEqual(result.issues.map(issue => issue.code), [
    'missing-prompt', 'invalid-duration', 'invalid-fps', 'missing-source-media'
  ]);
});

test('registry lists provider metadata without exposing implementation functions', () => {
  const registry = createVideoProviderRegistry();
  registry.register({
    id: 'local-demo',
    name: 'Local demo',
    taskTypes: ['image-to-video'],
    local: true,
    generate: async () => ({ status: 'pending', taskId: 'job-1' })
  });
  assert.deepEqual(registry.list(), [{
    id: 'local-demo',
    name: 'Local demo',
    taskTypes: ['image-to-video'],
    local: true,
    requiresUserKey: false
  }]);
  assert.equal(registry.get('local-demo').id, 'local-demo');
});

test('rejects malformed and duplicate providers', () => {
  const registry = createVideoProviderRegistry();
  assert.throws(() => registry.register({ id: 'bad id', taskTypes: ['image-to-video'], generate() {} }), /identifier/);
  assert.throws(() => registry.register({ id: 'no-runner', taskTypes: ['image-to-video'] }), /implement generate/);
  const provider = { id: 'demo', taskTypes: ['image-to-video'], generate: async () => ({ status: 'pending' }) };
  registry.register(provider);
  assert.throws(() => registry.register(provider), /already registered/);
});

test('runs a compatible provider and normalizes its pending job result', async () => {
  const registry = createVideoProviderRegistry();
  registry.register({
    id: 'mock-video',
    taskTypes: ['image-to-video'],
    generate: async request => {
      assert.equal(request.prompt, validRequest.prompt);
      return { taskId: 'task-123', status: 'processing' };
    }
  });
  const result = await generateVideoWithProvider(registry, 'mock-video', validRequest);
  assert.deepEqual(result, {
    providerId: 'mock-video',
    status: 'processing',
    taskId: 'task-123',
    video: null,
    url: '',
    error: ''
  });
});

test('blocks unsupported tasks and invalid requests before provider execution', async () => {
  const registry = createVideoProviderRegistry();
  let called = false;
  registry.register({
    id: 'image-only',
    taskTypes: ['image-to-video'],
    generate: async () => { called = true; return { status: 'pending' }; }
  });
  await assert.rejects(
    generateVideoWithProvider(registry, 'image-only', { ...validRequest, taskType: 'text-to-video' }),
    /does not support/
  );
  await assert.rejects(generateVideoWithProvider(registry, 'image-only', {}), error => error.code === 'INVALID_VIDEO_REQUEST');
  assert.equal(called, false);
});

test('requires output media for completed jobs and accepts completed video blobs', async () => {
  const registry = createVideoProviderRegistry();
  registry.register({ id: 'bad-output', taskTypes: ['image-to-video'], generate: async () => ({ status: 'completed' }) });
  await assert.rejects(generateVideoWithProvider(registry, 'bad-output', validRequest), /must include/);
  registry.register({
    id: 'good-output',
    taskTypes: ['image-to-video'],
    generate: async () => ({ status: 'completed', video: { type: 'video/webm' } })
  });
  const result = await generateVideoWithProvider(registry, 'good-output', validRequest);
  assert.equal(result.status, 'completed');
  assert.equal(result.video.type, 'video/webm');
});

test('supports cancellation before invoking the provider', async () => {
  const registry = createVideoProviderRegistry();
  let called = false;
  registry.register({ id: 'cancel-test', taskTypes: ['image-to-video'], generate: async () => { called = true; } });
  await assert.rejects(
    generateVideoWithProvider(registry, 'cancel-test', validRequest, { signal: { aborted: true } }),
    error => error.name === 'AbortError'
  );
  assert.equal(called, false);
});

test('removes registered providers cleanly', () => {
  const registry = createVideoProviderRegistry();
  registry.register({ id: 'temporary', taskTypes: ['text-to-video'], generate: async () => ({ status: 'pending' }) });
  assert.equal(registry.remove('temporary'), true);
  assert.equal(registry.get('temporary'), null);
  assert.equal(registry.remove('temporary'), false);
});

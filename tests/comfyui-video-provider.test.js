import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkComfyUIConnection,
  ComfyUIAdapterError,
  createComfyUIVideoProvider,
  normalizeComfyUIBaseUrl
} from '../src/comfyui-video-provider.js';
import { createVideoProviderRegistry, generateVideoWithProvider } from '../src/video-provider-contract.js';

const workflow = {
  '10': { class_type: 'CLIPTextEncode', inputs: { text: '' } },
  '20': { class_type: 'LoadImage', inputs: { image: '' } },
  '30': { class_type: 'VideoSettings', inputs: { seconds: 0, frame_rate: 0, frames: 0 } },
  '90': { class_type: 'SaveVideo', inputs: {} }
};
const nodeBindings = {
  prompt: { nodeId: '10', input: 'text' },
  image: { nodeId: '20', input: 'image' },
  durationSeconds: { nodeId: '30', input: 'seconds' },
  fps: { nodeId: '30', input: 'frame_rate' },
  frameCount: { nodeId: '30', input: 'frames' }
};
const request = {
  taskType: 'image-to-video',
  prompt: 'A small fox turns its head and blinks.',
  negativePrompt: 'identity change',
  image: new Blob(['source-image'], { type: 'image/png' }),
  durationSeconds: 4,
  fps: 24,
  aspectRatio: '16:9'
};

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

test('accepts loopback and private LAN addresses, rejects public hosts and credentials', () => {
  assert.equal(normalizeComfyUIBaseUrl('http://127.0.0.1:8188/'), 'http://127.0.0.1:8188');
  assert.equal(normalizeComfyUIBaseUrl('http://192.168.1.20:8188'), 'http://192.168.1.20:8188');
  assert.throws(() => normalizeComfyUIBaseUrl('https://example.com'), error => error.code === 'NON_LOCAL_BASE_URL');
  assert.throws(() => normalizeComfyUIBaseUrl('http://user:pass@localhost:8188'), error => error.code === 'NON_LOCAL_BASE_URL');
});

test('connection check reads system stats without submitting a workflow', async () => {
  let calledUrl = '';
  const result = await checkComfyUIConnection({
    baseUrl: 'http://127.0.0.1:8188',
    fetchImpl: async url => { calledUrl = url; return jsonResponse({ system: { comfyui_version: 'test' } }); }
  });
  assert.equal(calledUrl, 'http://127.0.0.1:8188/system_stats');
  assert.equal(result.ok, true);
  assert.equal(result.system.system.comfyui_version, 'test');
});

test('requires explicit prompt/image bindings and a selected video output node', () => {
  assert.throws(
    () => createComfyUIVideoProvider({ baseUrl: 'http://localhost:8188', workflow, nodeBindings: {}, outputNodeIds: ['90'] }),
    error => error.code === 'MISSING_REQUIRED_BINDING'
  );
  assert.throws(
    () => createComfyUIVideoProvider({ baseUrl: 'http://localhost:8188', workflow, nodeBindings, outputNodeIds: [] }),
    error => error.code === 'MISSING_OUTPUT_NODE'
  );
  assert.throws(
    () => createComfyUIVideoProvider({
      baseUrl: 'http://localhost:8188', workflow,
      nodeBindings: { prompt: { nodeId: '404', input: 'text' }, image: nodeBindings.image },
      outputNodeIds: ['90']
    }),
    error => error.code === 'INVALID_WORKFLOW_BINDING'
  );
});

test('uploads a source image, applies configured bindings and returns a completed video Blob', async () => {
  const calls = [];
  const progress = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/upload/image')) return jsonResponse({ name: 'source.png', subfolder: 'dravex', type: 'input' });
    if (String(url).endsWith('/prompt')) {
      const body = JSON.parse(options.body);
      assert.equal(body.prompt['10'].inputs.text, request.prompt);
      assert.equal(body.prompt['20'].inputs.image, 'dravex/source.png');
      assert.equal(body.prompt['30'].inputs.seconds, 4);
      assert.equal(body.prompt['30'].inputs.frame_rate, 24);
      assert.equal(body.prompt['30'].inputs.frames, 96);
      return jsonResponse({ prompt_id: 'job-123' });
    }
    if (String(url).endsWith('/history/job-123')) {
      return jsonResponse({
        'job-123': {
          status: { completed: true, status_str: 'success' },
          outputs: { '90': { videos: [{ filename: 'result.mp4', subfolder: 'dravex', type: 'output' }] } }
        }
      });
    }
    if (String(url).includes('/view?')) {
      return new Response(new Blob(['video-bytes'], { type: 'video/mp4' }), { status: 200 });
    }
    throw new Error('Unexpected URL: ' + url);
  };
  const provider = createComfyUIVideoProvider({
    baseUrl: 'http://127.0.0.1:8188',
    workflow,
    nodeBindings,
    outputNodeIds: ['90'],
    fetchImpl,
    pollIntervalMs: 250
  });
  const registry = createVideoProviderRegistry();
  registry.register(provider);
  const result = await generateVideoWithProvider(registry, provider.id, request, {
    onProgress: value => progress.push(value)
  });
  assert.equal(result.status, 'completed');
  assert.equal(result.taskId, 'job-123');
  assert.equal(result.video.type, 'video/mp4');
  assert.ok(result.video.size > 0);
  assert.equal(calls.length, 4);
  assert.ok(calls[0].options.body instanceof FormData);
  assert.equal(calls[1].url, 'http://127.0.0.1:8188/prompt');
  assert.equal(progress[0].stage, 'queued');
  assert.equal(progress.at(-1).stage, 'completed');
});

test('aligns frame counts for workflows that require 1 + N times 8 frames', async () => {
  let submittedWorkflow;
  const fetchImpl = async (url, options = {}) => {
    if (String(url).endsWith('/upload/image')) return jsonResponse({ name: 'source.png', subfolder: '', type: 'input' });
    if (String(url).endsWith('/prompt')) {
      submittedWorkflow = JSON.parse(options.body).prompt;
      return jsonResponse({ prompt_id: 'aligned-job' });
    }
    if (String(url).endsWith('/history/aligned-job')) {
      return jsonResponse({
        'aligned-job': {
          status: { completed: true, status_str: 'success' },
          outputs: { '90': { videos: [{ filename: 'aligned.mp4', type: 'output' }] } }
        }
      });
    }
    if (String(url).includes('/view?')) return new Response(new Blob(['video'], { type: 'video/mp4' }));
    throw new Error('Unexpected URL: ' + url);
  };
  const provider = createComfyUIVideoProvider({
    baseUrl: 'http://127.0.0.1:8188',
    workflow,
    nodeBindings,
    outputNodeIds: ['90'],
    fetchImpl,
    pollIntervalMs: 250,
    frameCountStep: 8,
    frameCountOffset: 1
  });
  await provider.generate(request);
  assert.equal(submittedWorkflow['30'].inputs.frames, 97);
});

test('rejects an already-aborted generation before making network requests', async () => {
  let calls = 0;
  const provider = createComfyUIVideoProvider({
    baseUrl: 'http://localhost:8188', workflow, nodeBindings, outputNodeIds: ['90'],
    fetchImpl: async () => { calls += 1; throw new Error('must not be called'); }
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    provider.generate(request, { signal: controller.signal }),
    error => error.name === 'AbortError'
  );
  assert.equal(calls, 0);
});

test('reports non-JSON and HTTP errors as typed adapter errors', async () => {
  await assert.rejects(
    checkComfyUIConnection({ baseUrl: 'http://localhost:8188', fetchImpl: async () => new Response('not json', { status: 200 }) }),
    error => error instanceof ComfyUIAdapterError && error.code === 'INVALID_RESPONSE'
  );
  await assert.rejects(
    checkComfyUIConnection({ baseUrl: 'http://localhost:8188', fetchImpl: async () => jsonResponse({ error: 'denied' }, 403) }),
    error => error instanceof ComfyUIAdapterError && error.code === 'HTTP_ERROR'
  );
});

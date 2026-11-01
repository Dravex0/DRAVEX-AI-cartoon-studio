import test from 'node:test';
import assert from 'node:assert/strict';
import { generateImageWithHorde } from '../src/ai-horde-image-provider.js';

const response = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload
});

test('submits an anonymous, SFW, explicitly shared prompt and retrieves the finished image', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/generate/async')) return response({ id: 'request-123' }, 202);
    if (url.endsWith('/generate/check/request-123')) return response({ done: true, finished: 1, waiting: 0, processing: 0 });
    if (url.endsWith('/generate/status/request-123')) return response({ shared: true, generations: [{ img: 'https://cdn.example.test/scene.webp', seed: 42, model: 'Test model', worker_name: 'Worker A' }] });
    throw new Error('Unexpected URL: ' + url);
  };
  const progress = [];
  const result = await generateImageWithHorde({
    prompt: 'A fox in a moonlit forest.',
    negativePrompt: 'No text, no extra characters.',
    fetchImpl,
    pollIntervalMs: 0,
    onProgress: value => progress.push(value)
  });
  assert.equal(result.imageUrl, 'https://cdn.example.test/scene.webp');
  assert.equal(result.seed, '42');
  assert.equal(result.shared, true);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].options.headers.apikey, '0000000000');
  assert.match(calls[0].options.headers['Client-Agent'], /DRAVEX-AI-Cartoon-Studio/);
  const body = JSON.parse(calls[0].options.body);
  assert.match(body.prompt, /###No text, no extra characters/);
  assert.equal(body.shared, true);
  assert.equal(body.nsfw, false);
  assert.equal(body.censor_nsfw, true);
  assert.equal(body.params.n, 1);
  assert.equal(progress.length, 1);
});

test('passes selected image dimensions and step count to the provider request', async () => {
  let submittedBody = null;
  const fetchImpl = async (url, options) => {
    if (url.endsWith('/generate/async')) {
      submittedBody = JSON.parse(options.body);
      return response({ id: 'quality-request' }, 202);
    }
    if (url.endsWith('/generate/check/quality-request')) return response({ done: true, finished: 1 });
    return response({ generations: [{ img: 'https://cdn.example.test/quality.webp' }] });
  };
  await generateImageWithHorde({ prompt: 'A cinematic scene.', width: 768, height: 768, steps: 30, fetchImpl, pollIntervalMs: 0 });
  assert.equal(submittedBody.params.width, 768);
  assert.equal(submittedBody.params.height, 768);
  assert.equal(submittedBody.params.steps, 30);
});

test('preserves the advertised 1024px landscape and portrait quality dimensions', async () => {
  const submitted = [];
  const fetchImpl = async (url, options) => {
    if (url.endsWith('/generate/async')) {
      submitted.push(JSON.parse(options.body).params);
      return response({ id: `resolution-${submitted.length}` }, 202);
    }
    if (url.includes('/generate/check/')) return response({ done: true, finished: 1 });
    return response({ generations: [{ img: 'https://cdn.example.test/resolution.webp' }] });
  };
  await generateImageWithHorde({ prompt: 'Landscape frame.', width: 1024, height: 576, fetchImpl, pollIntervalMs: 0 });
  await generateImageWithHorde({ prompt: 'Portrait frame.', width: 576, height: 1024, fetchImpl, pollIntervalMs: 0 });
  assert.deepEqual(submitted.map(({ width, height }) => [width, height]), [[1024, 576], [576, 1024]]);
});

test('still bounds oversized dimensions and rounds them to 64px increments', async () => {
  let submitted = null;
  const fetchImpl = async (url, options) => {
    if (url.endsWith('/generate/async')) {
      submitted = JSON.parse(options.body).params;
      return response({ id: 'bounded-resolution' }, 202);
    }
    if (url.endsWith('/generate/check/bounded-resolution')) return response({ done: true, finished: 1 });
    return response({ generations: [{ img: 'https://cdn.example.test/bounded.webp' }] });
  };
  await generateImageWithHorde({ prompt: 'Bounded frame.', width: 4096, height: 1280, fetchImpl, pollIntervalMs: 0 });
  assert.equal(submitted.width, 1024);
  assert.equal(submitted.height, 1024);
  assert.equal(submitted.width % 64, 0);
  assert.equal(submitted.height % 64, 0);
});

test('rejects an empty prompt without making a network request', async () => {
  let called = false;
  await assert.rejects(() => generateImageWithHorde({ prompt: ' ', fetchImpl: async () => { called = true; } }), /Add an image prompt/);
  assert.equal(called, false);
});

test('reports service errors without leaking request headers', async () => {
  const fetchImpl = async () => response({ message: 'Queue unavailable' }, 503);
  await assert.rejects(() => generateImageWithHorde({ prompt: 'A fox.', fetchImpl }), /Queue unavailable/);
});

test('rejects completed jobs without a usable image', async () => {
  const fetchImpl = async url => {
    if (url.endsWith('/generate/async')) return response({ id: 'empty-result' }, 202);
    if (url.endsWith('/generate/check/empty-result')) return response({ done: true, finished: 0 });
    return response({ generations: [] });
  };
  await assert.rejects(() => generateImageWithHorde({ prompt: 'A fox.', fetchImpl, pollIntervalMs: 0 }), /no usable image/);
});

test('rejects non-HTTPS result URLs', async () => {
  const fetchImpl = async url => {
    if (url.endsWith('/generate/async')) return response({ id: 'bad-url' }, 202);
    if (url.endsWith('/generate/check/bad-url')) return response({ done: true, finished: 1 });
    return response({ generations: [{ img: 'http://untrusted.example.test/image.webp' }] });
  };
  await assert.rejects(() => generateImageWithHorde({ prompt: 'A fox.', fetchImpl, pollIntervalMs: 0 }), /unsupported image result/);
});

test('cancels an unfinished request when the volunteer queue times out', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/generate/async')) return response({ id: 'slow-request' }, 202);
    if (url.endsWith('/generate/check/slow-request')) return response({ done: false, waiting: 1, queue_position: 1 });
    if (url.endsWith('/generate/status/slow-request')) return response({});
    throw new Error('Unexpected URL: ' + url);
  };
  await assert.rejects(() => generateImageWithHorde({
    prompt: 'A fox.', fetchImpl, pollIntervalMs: 1000, maxWaitMs: 1000
  }), /took too long/);
  assert.ok(calls.some(call => call.url.endsWith('/generate/status/slow-request') && call.options.method === 'DELETE'));
});

test('honors cancellation before submitting a job', async () => {
  const controller = new AbortController();
  controller.abort();
  let called = false;
  await assert.rejects(() => generateImageWithHorde({
    prompt: 'A fox.', signal: controller.signal, fetchImpl: async () => { called = true; }
  }), { name: 'AbortError' });
  assert.equal(called, false);
});

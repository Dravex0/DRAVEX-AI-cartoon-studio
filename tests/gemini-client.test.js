import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGeminiStoryboard, testGeminiConnection, FREE_GEMINI_MODEL } from '../src/gemini-client.js';

function mockFetch(payload, status = 200) {
  return async (url, options) => {
    assert.match(url, new RegExp(FREE_GEMINI_MODEL));
    assert.equal(options.headers['x-goog-api-key'], 'test-key');
    return { ok: status >= 200 && status < 300, status, json: async () => payload };
  };
}
const reply = value => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] });

test('uses only the fixed free-tier model and returns normalized unique scenes', async () => {
  const data = { scenes: [1,2,3].map(n => ({ title: 'Scene '+n, visibleAction: 'Action '+n, camera: 'Camera '+n })) };
  const result = await buildGeminiStoryboard({ apiKey:'test-key', idea:'A fox finds a star.', fetchImpl:mockFetch(reply(data)) });
  assert.equal(result.scenes.length, 3);
  assert.equal(result.scenes[2].visibleAction, 'Action 3');
});

test('rejects an empty key before making a request', async () => {
  await assert.rejects(() => buildGeminiStoryboard({ apiKey:'', idea:'A story' }), /API key/);
});

test('rejects invalid scene structure', async () => {
  await assert.rejects(() => buildGeminiStoryboard({ apiKey:'test-key', idea:'A story', fetchImpl:mockFetch(reply({ scenes:[{title:'Only title'},{title:'Second',visibleAction:'Action 2',camera:'Camera 2'},{title:'Third',visibleAction:'Action 3',camera:'Camera 3'}] })) }), /missing/);
});

test('handles free-tier quota limits without suggesting paid upgrade', async () => {
  await assert.rejects(() => buildGeminiStoryboard({ apiKey:'test-key', idea:'A story', fetchImpl:mockFetch({},429) }), /free quota or rate limit/);
});

test('checks a live connection response', async () => {
  const payload = { candidates: [{ content: { parts: [{ text: 'DRAVEX_GEMINI_OK' }] } }] };
  assert.equal(await testGeminiConnection({ apiKey:'test-key', fetchImpl:mockFetch(payload) }), true);
});

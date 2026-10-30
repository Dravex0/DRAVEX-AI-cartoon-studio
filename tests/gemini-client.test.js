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

test('uses the free-tier model and returns normalized animation-ready scene data', async () => {
  const data = { scenes: [1,2,3].map(n => ({
    title: 'Scene '+n, visibleAction: 'Action '+n, camera: 'Camera '+n, imagePrompt: 'Still frame '+n, motionPrompt: 'Motion '+n, negativePrompt: 'No extra character', continuityLock: 'Foxy remains orange',
    characters: ['Foxy'], location: 'Forest', startState: 'Standing', endState: 'Running',
    dialogue: [{ characterId: 'Foxy', text: 'Hello' }], durationSeconds: 4, sound: 'Wind'
  })) };
  const result = await buildGeminiStoryboard({ apiKey:'test-key', idea:'A fox finds a star.', fetchImpl:mockFetch(reply(data)) });
  assert.equal(result.scenes.length, 3);
  assert.equal(result.scenes[2].visibleAction, 'Action 3');
  assert.deepEqual(result.scenes[0].characters, ['Foxy']);
  assert.equal(result.scenes[0].durationSeconds, 3);
  assert.equal(result.scenes[0].imagePrompt, 'Still frame 1');
  assert.equal(result.scenes[0].motionPrompt, 'Motion 1');
  assert.equal(result.scenes[0].continuityLock, 'Foxy remains orange');
  assert.equal(result.scenes[0].dialogue[0].text, 'Hello');
});

test('sends the complete story and explicit production directions to Gemini', async () => {
  let sentPrompt = '';
  const fetchImpl = async (_url, options) => {
    sentPrompt = JSON.parse(options.body).contents[0].parts[0].text;
    return { ok: true, status: 200, json: async () => reply({ scenes: [1,2,3,4,5,6].map(n => ({ title:'Scene '+n, visibleAction:'Action '+n, camera:'Camera '+n })) }) };
  };
  await buildGeminiStoryboard({
    apiKey: 'test-key',
    idea: 'Стиль: акварель\nКоличество сцен: 6\nНе добавлять: новых героев\nЛисёнок находит ключ. Он открывает ворота.',
    language: 'ru', fetchImpl
  });
  assert.match(sentPrompt, /ORIGINAL USER BRIEF/);
  assert.match(sentPrompt, /акварель/);
  assert.match(sentPrompt, /exactly 6 scenes/);
  assert.match(sentPrompt, /Лисёнок находит ключ/);
  assert.match(sentPrompt, /Do not invent major characters/);
});

test('rejects a response that ignores an explicitly requested scene count', async () => {
  await assert.rejects(() => buildGeminiStoryboard({
    apiKey: 'test-key',
    idea: 'Количество сцен: 6\nA fox finds a star.',
    fetchImpl: mockFetch(reply({ scenes: [1,2,3,4,5].map(n => ({ title:'Scene '+n, visibleAction:'Action '+n, camera:'Camera '+n })) }))
  }), /requested 6/);
});

test('enforces the requested duration for every scene and returns a stable character bible', async () => {
  const payload = { characterBible: [{ characterId: 'Foxy', visualDescription: 'Small orange fox', clothing: 'Blue scarf', colors: 'Orange and blue', distinctiveFeatures: 'White tail tip' }], scenes: [1,2,3].map(n => ({
    title: 'Scene '+n, visibleAction: 'Action '+n, camera: 'Camera '+n,
    characters: ['Foxy'], durationSeconds: 12, startState: 'Start', endState: 'End'
  })) };
  const result = await buildGeminiStoryboard({
    apiKey: 'test-key',
    idea: 'Длительность: 5 секунд\nЛисёнок находит звезду.',
    duration: 3,
    fetchImpl: mockFetch(reply(payload))
  });
  assert.equal(result.brief.requestedDurationSeconds, 5);
  assert.ok(result.scenes.every(scene => scene.durationSeconds === 5));
  assert.equal(result.characterBible[0].visualDescription, 'Small orange fox');
  assert.match(result.scenes[0].imagePrompt, /Action 1/);
  assert.match(result.scenes[0].motionPrompt, /Start/);
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

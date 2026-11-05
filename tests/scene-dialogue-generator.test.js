import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneDialoguePrompt, generateSceneDialogue, parseSceneDialogueResponse } from '../src/scene-dialogue-generator.js';

const scene = {
  id: 'scene_2',
  title: 'The discovery',
  storyDetail: 'Mira discovers a glowing key beside the old gate.',
  visibleAction: 'Mira picks up the glowing key and examines it.',
  description: 'A close-up of Mira holding the key.',
  characters: ['Mira']
};

test('prompt locks scene facts, assigned speakers and requested language', () => {
  const prompt = buildSceneDialoguePrompt({ scene, language: 'uk', request: 'Write warm dialogue.' });
  assert.match(prompt, /Ukrainian/);
  assert.match(prompt, /scene_2/);
  assert.match(prompt, /Mira/);
  assert.match(prompt, /Do not add new plot events/);
});

test('accepts exact scene ID and only assigned characters or narrator', () => {
  const result = parseSceneDialogueResponse(JSON.stringify({
    sceneId: 'scene_2',
    lines: [{ speaker: 'Mira', text: 'Що це за ключ?' }, { speaker: 'Narrator', text: 'Ворота повільно засвітилися.' }]
  }), scene, 'uk');
  assert.equal(result.ok, true);
  assert.deepEqual(result.lines.map(line => line.language), ['uk', 'uk']);
});

test('rejects wrong scene, invented speaker, empty text and excessive lines', () => {
  assert.equal(parseSceneDialogueResponse('{"sceneId":"scene_1","lines":[{"speaker":"Mira","text":"Hi"}]}', scene).reason, 'scene-id-mismatch');
  assert.equal(parseSceneDialogueResponse('{"sceneId":"scene_2","lines":[{"speaker":"Wizard","text":"Hi"}]}', scene).reason, 'unknown-speaker');
  assert.equal(parseSceneDialogueResponse('{"sceneId":"scene_2","lines":[{"speaker":"Mira","text":""}]}', scene).reason, 'empty-speaker-or-text');
  assert.equal(parseSceneDialogueResponse('{"sceneId":"scene_2","lines":[{"speaker":"Mira","text":"1"},{"speaker":"Mira","text":"2"},{"speaker":"Mira","text":"3"}]}', scene).reason, 'invalid-line-count');
});

test('accepts a fenced JSON object surrounded by model text only when exact object parses', () => {
  const result = parseSceneDialogueResponse('Result:\n```json\n{"sceneId":"scene_2","lines":[{"speaker":"Mira","text":"I found it."}]}\n```', scene);
  assert.equal(result.ok, true);
});

test('generates through the injected local runtime and forwards cancellation', async () => {
  let captured;
  const runtime = {
    status: { modelId: 'local-test', backend: 'wasm' },
    async generate(prompt, options) {
      captured = { prompt, options };
      return { text: '{"sceneId":"scene_2","lines":[{"speaker":"Mira","text":"I found it."}]}' };
    }
  };
  const result = await generateSceneDialogue({ runtime, scene, language: 'en' });
  assert.equal(result.ok, true);
  assert.equal(result.modelId, 'local-test');
  assert.equal(captured.options.maxNewTokens, 256);
  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(await generateSceneDialogue({ runtime, scene, signal: controller.signal }), { ok: false, reason: 'cancelled' });
});

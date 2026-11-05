import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneDialoguePrompt, validateSceneDialogueResponse } from '../src/scene-dialogue-generator.js';

const scene = {
  id: 'scene-1',
  title: 'The discovery',
  storyDetail: 'Mira finds a glowing key beside the old gate.',
  visibleAction: 'Mira picks up the key and looks at the gate.',
  characters: ['Mira']
};

test('builds a local prompt grounded in the exact scene and assigned cast', () => {
  const prompt = buildSceneDialoguePrompt({
    sourceRequest: 'Create a short fantasy film',
    scene,
    sceneNumber: 2,
    sceneCount: 5,
    language: 'en',
    mainCharacter: 'Mira'
  });
  assert.match(prompt, /Return ONLY valid JSON/);
  assert.match(prompt, /The discovery/);
  assert.match(prompt, /Mira/);
  assert.match(prompt, /scene 2 of 5/i);
  assert.match(prompt, /Do not invent characters/);
});

test('accepts valid dialogue from assigned characters and preserves the language', () => {
  const result = validateSceneDialogueResponse('{"dialogue":[{"characterId":"Mira","text":"This key must open the gate."}]}', {
    scene, language: 'en'
  });
  assert.deepEqual(result, {
    ok: true,
    dialogue: [{ characterId: 'Mira', text: 'This key must open the gate.', language: 'en' }]
  });
});

test('accepts a bounded JSON object wrapped in model commentary and markdown fences', () => {
  const result = validateSceneDialogueResponse('Here is the result:\n```json\n{"dialogue":[{"characterId":"Mira","text":"Look at this."}]}\n```', {
    scene, language: 'en'
  });
  assert.equal(result.ok, true);
  assert.equal(result.dialogue[0].characterId, 'Mira');
});

test('allows narrator only as a declared fallback speaker', () => {
  const result = validateSceneDialogueResponse('{"dialogue":[{"characterId":"Narrator","text":"A strange discovery changes the journey."}]}', {
    scene, language: 'en'
  });
  assert.equal(result.ok, true);
  assert.equal(result.dialogue[0].characterId, 'Narrator');
});

test('rejects unknown speakers rather than adding characters to the film', () => {
  const result = validateSceneDialogueResponse('{"dialogue":[{"characterId":"Unknown stranger","text":"Follow me."}]}', {
    scene, language: 'en'
  });
  assert.deepEqual(result, { ok: false, reason: 'unknown-speaker-1' });
});

test('rejects invalid JSON, empty text, stage directions and excessive lines', () => {
  assert.equal(validateSceneDialogueResponse('not json', { scene }).reason, 'invalid-json');
  assert.equal(validateSceneDialogueResponse('{"dialogue":[{"characterId":"Mira","text":" " }]}', { scene }).reason, 'empty-line-1');
  assert.equal(validateSceneDialogueResponse('{"dialogue":[{"characterId":"Mira","text":"Mira: Hello"}]}', { scene }).reason, 'speaker-prefix-in-text-1');
  assert.equal(validateSceneDialogueResponse('{"dialogue":[{"characterId":"Mira","text":"A"},{"characterId":"Mira","text":"B"},{"characterId":"Mira","text":"C"},{"characterId":"Mira","text":"D"},{"characterId":"Mira","text":"E"}]}', { scene }).reason, 'invalid-line-count');
});

test('uses the selected main character only when the scene has no assigned cast', () => {
  const result = validateSceneDialogueResponse('{"dialogue":[{"text":"We should keep moving."}]}', {
    scene: { ...scene, characters: [] }, mainCharacter: 'Mira', language: 'uk'
  });
  assert.deepEqual(result, {
    ok: true,
    dialogue: [{ characterId: 'Mira', text: 'We should keep moving.', language: 'uk' }]
  });
});

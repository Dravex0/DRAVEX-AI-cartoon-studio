import test from 'node:test';
import assert from 'node:assert/strict';
import { directStoryboardWithLocalAI } from '../src/local-story-director.js';
import { buildStoryboardFromText } from '../src/storyboard-generator.js';

const basePlan = buildStoryboardFromText(
  'A fox finds a silver key. The forest becomes dark. A small bird guides the fox home.',
  'en',
  'Foxy'
);
const goodScenes = [
  { title: 'The discovery', visibleAction: 'Foxy kneels beside the silver key and carefully lifts it into the moonlight.', camera: 'Low-angle close-up that slowly pushes toward the key.' },
  { title: 'The blackout', visibleAction: 'A dark wave moves between the trees and the fox turns toward the fading forest lights.', camera: 'Wide overhead shot that slowly tilts down through the branches.' },
  { title: 'The guidance', visibleAction: 'A small bird circles above Foxy and leads the fox along a glowing path toward home.', camera: 'Lateral tracking shot that follows the bird and fox together.' },
  { title: 'The journey', visibleAction: 'Foxy follows the narrow trail while keeping the silver key raised to light the ground.', camera: 'Side-on medium shot with a smooth travelling camera move.' },
  { title: 'The return', visibleAction: 'Foxy reaches the familiar doorway and lowers the key as warm light fills the clearing.', camera: 'Slow pull-back to a calm wide final composition.' }
];

function runtimeReturning(scenes, overrides = {}) {
  return {
    status: { modelId: 'mock-local-model', backend: 'wasm' },
    generate: async () => ({ text: JSON.stringify({ scenes }), modelId: 'mock-local-model', backend: 'wasm' }),
    ...overrides
  };
}

test('accepts a high-quality local director candidate while locking story details and characters', async () => {
  const candidate = goodScenes.map(scene => ({ ...scene, storyDetail: 'rewritten by model', characters: ['invented character'] }));
  const result = await directStoryboardWithLocalAI({
    runtime: runtimeReturning(candidate),
    basePlan,
    storyText: 'A fox finds a silver key. The forest becomes dark. A small bird guides the fox home.',
    language: 'English',
    character: 'Foxy'
  });
  assert.equal(result.usedLocalModel, true);
  assert.equal(result.evaluation.passed, true);
  assert.deepEqual(result.scenes.map(scene => scene.storyDetail), basePlan.scenes.map(scene => scene.storyDetail));
  assert.ok(result.scenes.every(scene => scene.characters.includes('Foxy')));
  assert.ok(result.scenes.every(scene => !scene.characters.includes('invented character')));
  assert.equal(result.backend, 'wasm');
});

test('rejects repetitive or vague model directions and returns the deterministic baseline', async () => {
  const repeated = goodScenes.map(scene => ({ ...scene, visibleAction: 'The character stands there and looks around without doing anything.', camera: 'Static wide shot.' }));
  const result = await directStoryboardWithLocalAI({ runtime: runtimeReturning(repeated), basePlan });
  assert.equal(result.usedLocalModel, false);
  assert.equal(result.fallbackReason, 'candidate-failed-story-quality-gate');
  assert.deepEqual(result.scenes, basePlan.scenes);
  assert.ok(result.evaluation.issues.length > 0);
});

test('falls back when the model returns malformed JSON or the wrong number of scenes', async () => {
  const malformed = await directStoryboardWithLocalAI({
    runtime: { generate: async () => ({ text: 'not json' }) },
    basePlan
  });
  assert.equal(malformed.usedLocalModel, false);
  assert.equal(malformed.fallbackReason, 'invalid-model-scene-structure');
  const short = await directStoryboardWithLocalAI({
    runtime: runtimeReturning(goodScenes.slice(0, 2)),
    basePlan
  });
  assert.equal(short.usedLocalModel, false);
  assert.deepEqual(short.scenes, basePlan.scenes);
});

test('falls back cleanly when local inference fails or runtime is missing', async () => {
  const failed = await directStoryboardWithLocalAI({
    runtime: { generate: async () => { throw new Error('model unavailable'); } },
    basePlan
  });
  assert.equal(failed.fallbackReason, 'local-inference-failed: model unavailable');
  const missing = await directStoryboardWithLocalAI({ basePlan });
  assert.equal(missing.fallbackReason, 'local-runtime-unavailable');
});

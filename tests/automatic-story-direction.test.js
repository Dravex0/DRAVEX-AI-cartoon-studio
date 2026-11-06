import test from 'node:test';
import assert from 'node:assert/strict';
import { directStoryboardForFilm } from '../src/automatic-story-direction.js';

const basePlan = {
  scenes: [
    { id: 'scene_1', title: 'Start', storyDetail: 'A fox finds a key.', characters: ['Foxy'], durationSeconds: 3 },
    { id: 'scene_2', title: 'Finish', storyDetail: 'The fox opens the gate.', characters: ['Foxy'], durationSeconds: 3 }
  ]
};

test('keeps the exact baseline when the local model is not loaded', async () => {
  const result = await directStoryboardForFilm({ runtime: { status: { loaded: false } }, basePlan });
  assert.equal(result.usedLocalModel, false);
  assert.equal(result.fallbackReason, 'local-model-not-loaded');
  assert.deepEqual(result.scenes, basePlan.scenes);
});

test('keeps the baseline when the storyboard is empty', async () => {
  const result = await directStoryboardForFilm({ runtime: { status: { loaded: true }, generate: async () => ({ text: '[]' }) }, basePlan: { scenes: [] } });
  assert.equal(result.fallbackReason, 'storyboard-empty');
  assert.deepEqual(result.scenes, []);
});

test('uses the existing quality-gated director and preserves locked source details', async () => {
  const scenes = [
    { title: 'The discovery', visibleAction: 'Foxy kneels beside the silver key and carefully lifts it into the moonlight.', camera: 'Low-angle close-up that slowly pushes toward the key.', imagePrompt: 'A cinematic still of Foxy lifting a silver key in moonlight.', motionPrompt: 'Foxy bends down and raises the key slowly.', startState: 'Foxy stands beside the silver key.', endState: 'Foxy holds the silver key at chest height in the moonlit forest.' },
    { title: 'The blackout', visibleAction: 'A dark wave moves between the trees and the fox turns toward the fading forest lights.', camera: 'Wide overhead shot that slowly tilts down through the branches.', imagePrompt: 'The forest lights fade around Foxy beneath tall trees.', motionPrompt: 'A dark wave moves between the trees as Foxy turns.', startState: 'Foxy holds the silver key at chest height in the moonlit forest.', endState: 'Foxy faces the dark shadow while holding the silver key in the forest.' }
  ];
  const plan = {
    scenes: scenes.map((scene, index) => ({
      ...basePlan.scenes[index],
      ...scene
    }))
  };
  const runtime = {
    status: { loaded: true, modelId: 'mock', backend: 'wasm' },
    generate: async () => ({ text: JSON.stringify({ scenes }), modelId: 'mock', backend: 'wasm' })
  };
  const result = await directStoryboardForFilm({
    runtime,
    basePlan: plan,
    storyText: 'A fox finds a key. The forest becomes dark.',
    character: 'Foxy'
  });
  assert.equal(result.usedLocalModel, true);
  assert.equal(result.evaluation.passed, true);
  assert.deepEqual(result.scenes.map(scene => scene.storyDetail), plan.scenes.map(scene => scene.storyDetail));
  assert.ok(result.scenes.every(scene => scene.characters.includes('Foxy')));
});

test('rejects low-quality AI output and returns the original scenes', async () => {
  const repeated = [
    { title: 'One', visibleAction: 'The character stands there and looks around without doing anything.', camera: 'Static wide shot.', imagePrompt: 'A character standing.', motionPrompt: 'The character stands still.', startState: 'Standing.', endState: 'Still standing.' },
    { title: 'Two', visibleAction: 'The character stands there and looks around without doing anything.', camera: 'Static wide shot.', imagePrompt: 'A character standing.', motionPrompt: 'The character stands still.', startState: 'Standing.', endState: 'Still standing.' }
  ];
  const plan = { scenes: repeated.map((scene, index) => ({ ...basePlan.scenes[index], ...scene })) };
  const runtime = {
    status: { loaded: true },
    generate: async () => ({ text: JSON.stringify({ scenes: repeated }) })
  };
  const result = await directStoryboardForFilm({ runtime, basePlan: plan });
  assert.equal(result.usedLocalModel, false);
  assert.equal(result.fallbackReason, 'candidate-failed-story-quality-gate');
  assert.deepEqual(result.scenes, plan.scenes);
});

test('returns a cancelled result when cancellation is requested before direction starts', async () => {
  const controller = new AbortController();
  controller.abort();
  let generated = false;
  const result = await directStoryboardForFilm({
    runtime: { status: { loaded: true }, generate: async () => { generated = true; return { text: '[]' }; } },
    basePlan,
    signal: controller.signal
  });
  assert.equal(result.status, 'cancelled');
  assert.equal(generated, false);
  assert.deepEqual(result.scenes, basePlan.scenes);
});

test('discards a local model result when cancellation occurs during inference', async () => {
  const controller = new AbortController();
  const resultPromise = directStoryboardForFilm({
    runtime: {
      status: { loaded: true },
      generate: async (_prompt, options) => {
        assert.equal(options.signal, controller.signal);
        controller.abort();
        const error = new Error('cancelled');
        error.name = 'AbortError';
        throw error;
      }
    },
    basePlan,
    signal: controller.signal
  });
  const result = await resultPromise;
  assert.equal(result.status, 'cancelled');
  assert.equal(result.usedLocalModel, false);
  assert.deepEqual(result.scenes, basePlan.scenes);
});

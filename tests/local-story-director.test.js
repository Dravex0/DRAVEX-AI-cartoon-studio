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
  { title: 'The discovery', visibleAction: 'Foxy kneels beside the silver key and carefully lifts it into the moonlight.', camera: 'Low-angle close-up that slowly pushes toward the key.', imagePrompt: 'A cinematic still of Foxy lifting a silver key in moonlight.', motionPrompt: 'Foxy bends down and raises the key slowly.', startState: 'Foxy stands beside the silver key.', endState: 'Foxy holds the silver key at chest height in the moonlit forest.' },
  { title: 'The blackout', visibleAction: 'A dark wave moves between the trees and the fox turns toward the fading forest lights.', camera: 'Wide overhead shot that slowly tilts down through the branches.', imagePrompt: 'The forest lights fade around Foxy beneath tall trees.', motionPrompt: 'A dark wave moves between the trees as Foxy turns.', startState: 'Foxy holds the silver key at chest height in the moonlit forest.', endState: 'Foxy faces the dark shadow while holding the silver key in the forest.' },
  { title: 'The guidance', visibleAction: 'A small bird circles above Foxy and leads the fox along a glowing path toward home.', camera: 'Lateral tracking shot that follows the bird and fox together.', imagePrompt: 'A small bird guides Foxy along a glowing forest path.', motionPrompt: 'The bird circles once and flies forward while Foxy follows.', startState: 'Foxy faces the dark shadow while holding the silver key in the forest.', endState: 'Foxy follows the small bird along a glowing forest path while holding the silver key.' },
  { title: 'The journey', visibleAction: 'Foxy follows the narrow trail while keeping the silver key raised to light the ground.', camera: 'Side-on medium shot with a smooth travelling camera move.', imagePrompt: 'Foxy walks along a narrow trail with the key lighting the ground.', motionPrompt: 'Foxy walks carefully while the key casts moving light.', startState: 'Foxy follows the small bird along a glowing forest path while holding the silver key.', endState: 'Foxy reaches the familiar home clearing while holding the silver key.' },
  { title: 'The return', visibleAction: 'Foxy reaches the familiar doorway and lowers the key as warm light fills the clearing.', camera: 'Slow pull-back to a calm wide final composition.', imagePrompt: 'Foxy returns home as warm light fills the forest clearing.', motionPrompt: 'Foxy lowers the key and looks toward the warmly lit doorway.', startState: 'Foxy reaches the familiar home clearing while holding the silver key.', endState: 'Foxy stands safely at the glowing doorway, still holding the silver key.' }
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


test('rejects a local director candidate that breaks scene-to-scene state continuity', async () => {
  const broken = goodScenes.map(scene => ({ ...scene }));
  broken[1].startState = 'A spaceship flies above the ocean.';
  const result = await directStoryboardWithLocalAI({ runtime: runtimeReturning(broken), basePlan });
  assert.equal(result.usedLocalModel, false);
  assert.equal(result.fallbackReason, 'candidate-failed-story-quality-gate');
  assert.ok(result.evaluation.continuityReport.issues.some(issue => issue.code === 'state-transition-mismatch'));
  assert.deepEqual(result.scenes, basePlan.scenes);
});


test('locks multiple assigned characters and evaluates their visual reference profiles', async () => {
  const multiCharacterPlan = {
    ...basePlan,
    scenes: basePlan.scenes.map((scene, index) => ({
      ...scene,
      characters: index < 2 ? ['Foxy'] : ['Foxy', 'Bird']
    }))
  };
  const characterBible = [
    { characterId: 'Foxy', visualDescription: 'Small orange fox with amber eyes', clothing: 'Blue scarf', colors: 'Orange and cream', distinctiveFeatures: 'White tail tip' },
    { characterId: 'Bird', visualDescription: 'Tiny blue songbird', clothing: 'None', colors: 'Blue and yellow', distinctiveFeatures: 'Golden chest' }
  ];
  let capturedPrompt = '';
  const runtime = runtimeReturning(goodScenes, {
    generate: async prompt => {
      capturedPrompt = prompt;
      return { text: JSON.stringify({ scenes: goodScenes }), modelId: 'mock-local-model', backend: 'wasm' };
    }
  });
  const result = await directStoryboardWithLocalAI({
    runtime,
    basePlan: multiCharacterPlan,
    character: 'Foxy',
    characterBible
  });
  assert.equal(result.usedLocalModel, true);
  assert.deepEqual(result.scenes[2].characters, ['Foxy', 'Bird']);
  assert.equal(result.evaluation.metrics.characterReferenceCoverage, 100);
  assert.ok(capturedPrompt.includes('Tiny blue songbird'));
  assert.ok(capturedPrompt.includes('White tail tip'));
  assert.ok(capturedPrompt.includes('"assignedCharacters":["Foxy","Bird"]'));
});

test('rejects multi-character direction when an assigned character has no reference profile', async () => {
  const multiCharacterPlan = {
    ...basePlan,
    scenes: basePlan.scenes.map((scene, index) => ({
      ...scene,
      characters: index === 2 ? ['Foxy', 'Bird'] : ['Foxy']
    }))
  };
  const result = await directStoryboardWithLocalAI({
    runtime: runtimeReturning(goodScenes),
    basePlan: multiCharacterPlan,
    character: 'Foxy',
    characterBible: [{ characterId: 'Foxy', visualDescription: 'Orange fox' }]
  });
  assert.equal(result.usedLocalModel, false);
  assert.equal(result.fallbackReason, 'candidate-failed-story-quality-gate');
  assert.ok(result.evaluation.continuityReport.issues.some(issue =>
    issue.code === 'character-reference-missing' && issue.characterId === 'Bird'
  ));
  assert.deepEqual(result.scenes, multiCharacterPlan.scenes);
});

test('rejects a candidate that omits production-ready image or motion prompts', async () => {
  const incomplete = goodScenes.map(scene => ({ ...scene, imagePrompt: '', motionPrompt: '' }));
  const result = await directStoryboardWithLocalAI({ runtime: runtimeReturning(incomplete), basePlan });
  assert.equal(result.usedLocalModel, false);
  assert.equal(result.fallbackReason, 'candidate-failed-story-quality-gate');
  assert.ok(result.evaluation.issues.some(issue => issue.code === 'production-fields-incomplete'));
});

test('locks directed character interaction and keeps actor-target direction in local AI output', async () => {
  const interaction = {
    type: 'guide',
    actorId: 'Bird',
    targetId: 'Foxy',
    evidence: 'Bird guides Foxy home'
  };
  const interactionPlan = {
    ...basePlan,
    scenes: basePlan.scenes.map((scene, index) => index === 2
      ? { ...scene, characters: ['Bird', 'Foxy'], interaction }
      : scene)
  };
  let prompt = '';
  const runtime = runtimeReturning(goodScenes, {
    generate: async value => {
      prompt = value;
      return { text: JSON.stringify({ scenes: goodScenes }), modelId: 'mock-local-model', backend: 'wasm' };
    }
  });
  const result = await directStoryboardWithLocalAI({ runtime, basePlan: interactionPlan });
  assert.equal(result.usedLocalModel, true);
  assert.deepEqual(result.scenes[2].interaction, interaction);
  assert.ok(prompt.includes('"actorId":"Bird"'));
  assert.ok(prompt.includes('"targetId":"Foxy"'));
});

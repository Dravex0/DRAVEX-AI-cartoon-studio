import test from 'node:test';
import assert from 'node:assert/strict';
import { buildImageGenerationPrompt, buildMotionGenerationPrompt, validateSceneProductionReadiness } from '../src/scene-production.js';

const scene = {
  title: 'The key turns',
  imagePrompt: 'A small orange fox holds a silver key before an ancient gate.',
  motionPrompt: 'The fox slowly turns the key; the gate opens and dust falls.',
  negativePrompt: 'No extra characters, no text, no costume changes.',
  continuityLock: 'Orange fur, blue scarf, silver key stays in the right paw.',
  characters: ['foxy'],
  location: 'Moss-covered stone gate',
  timeOfDay: 'Blue hour',
  camera: 'Medium close-up, slow push-in',
  startState: 'The key is outside the lock.',
  endState: 'The key is turned and the gate is slightly open.'
};
const bible = [{ characterId: 'foxy', visualDescription: 'Small orange fox with white tail tip', clothing: 'Blue scarf', colors: 'Orange and blue', distinctiveFeatures: 'White tail tip' }];

test('image prompt builder includes scene, setting, camera, character bible and negative constraints', () => {
  const prompt = buildImageGenerationPrompt(scene, bible);
  assert.match(prompt, /silver key/);
  assert.match(prompt, /Moss-covered stone gate/);
  assert.match(prompt, /Medium close-up/);
  assert.match(prompt, /Small orange fox/);
  assert.match(prompt, /No extra characters/);
});

test('motion prompt builder separates temporal action and preserves continuity', () => {
  const prompt = buildMotionGenerationPrompt(scene, bible);
  assert.match(prompt, /slowly turns the key/);
  assert.match(prompt, /Start state/);
  assert.match(prompt, /End state/);
  assert.match(prompt, /Blue scarf/);
  assert.match(prompt, /do not introduce new objects/i);
});

test('prompt builders handle missing optional metadata without throwing', () => {
  assert.match(buildImageGenerationPrompt({ imagePrompt: 'A bird lands.' }), /A bird lands/);
  assert.match(buildMotionGenerationPrompt({ visibleAction: 'A bird lands.' }), /A bird lands/);
});

test('readiness validator identifies missing production fields', () => {
  const result = validateSceneProductionReadiness({ title: 'A scene' });
  assert.equal(result.ready, false);
  assert.deepEqual(result.issues.map(issue => issue.code), [
    'missing-image-prompt', 'missing-motion-prompt', 'missing-camera-plan', 'missing-start-state', 'missing-end-state'
  ]);
});

test('readiness validator accepts a complete scene', () => {
  assert.deepEqual(validateSceneProductionReadiness(scene), { ready: true, issues: [] });
});

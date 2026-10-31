import test from 'node:test';
import assert from 'node:assert/strict';
import { buildImageGenerationPrompt, buildMotionGenerationPrompt, buildProductionScene, validateSceneProductionReadiness } from '../src/scene-production.js';

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

test('image prompt builder can omit negative text when a provider accepts it separately', () => {
  const prompt = buildImageGenerationPrompt(scene, bible, { includeNegative: false });
  assert.match(prompt, /silver key/);
  assert.doesNotMatch(prompt, /Avoid: No extra characters/);
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

test('character reference matching is case-insensitive and includes only characters in the scene', () => {
  const profiles = [
    { characterId: 'Foxy', visualDescription: 'Orange fox', clothing: 'Blue scarf' },
    { characterId: 'Bird', visualDescription: 'Small yellow bird', clothing: 'Red cap' },
    { characterId: 'Villain', visualDescription: 'Dark wolf' }
  ];
  const prompt = buildImageGenerationPrompt({ imagePrompt: 'Two friends meet.', characters: ['foXY', 'BIRD'] }, profiles);
  assert.match(prompt, /Orange fox/);
  assert.match(prompt, /Small yellow bird/);
  assert.doesNotMatch(prompt, /Dark wolf/);
});

test('character prompt references are not duplicated when duplicate profiles are supplied', () => {
  const profile = { characterId: 'Foxy', visualDescription: 'Orange fox' };
  const prompt = buildMotionGenerationPrompt({ visibleAction: 'The fox waves.', characters: ['foxy'] }, [profile, profile]);
  assert.equal(prompt.split('Orange fox').length - 1, 1);
});

test('empty scene character list keeps the existing all-profile fallback', () => {
  const prompt = buildImageGenerationPrompt({ imagePrompt: 'A forest scene.' }, [
    { characterId: 'Foxy', visualDescription: 'Orange fox' },
    { characterId: 'Bird', visualDescription: 'Yellow bird' }
  ]);
  assert.match(prompt, /Orange fox/);
  assert.match(prompt, /Yellow bird/);
});

test('builds a canonical production record and separates image from motion prompts', () => {
  const prepared = buildProductionScene({
    id: 'scene_1', title: 'The key', storyDetail: 'Foxy finds a silver key.',
    visibleAction: 'Foxy lifts the key.', camera: 'Medium close-up',
    characters: ['Foxy'], durationSeconds: 4
  }, [{ characterId: 'Foxy', visualDescription: 'Small orange fox', clothing: 'Blue scarf' }]);
  assert.match(prepared.imagePrompt, /silver key/);
  assert.match(prepared.motionPrompt, /lifts the key/);
  assert.match(prepared.imageGenerationPrompt, /Small orange fox/);
  assert.match(prepared.motionGenerationPrompt, /Blue scarf/);
  assert.equal(prepared.durationSeconds, 4);
  assert.equal(prepared.productionReadiness.ready, false);
  assert.ok(prepared.productionReadiness.issues.some(issue => issue.code === 'missing-start-state'));
});

test('does not invent missing continuity states or accept invalid duration', () => {
  const prepared = buildProductionScene({
    title: 'A scene', visibleAction: 'A bird lands.', camera: 'Wide shot', durationSeconds: 99
  });
  assert.equal(prepared.startState, '');
  assert.equal(prepared.endState, '');
  assert.ok(prepared.productionReadiness.issues.some(issue => issue.code === 'invalid-duration'));
});

test('readiness reports missing character references and dialogue cast mismatch', () => {
  const result = validateSceneProductionReadiness({
    title: 'Dialogue', imagePrompt: 'Two friends talk.', motionPrompt: 'They talk.',
    camera: 'Two-shot', startState: 'They face each other.', endState: 'They smile.',
    characters: ['Foxy', 'Snowball'], dialogue: [{ characterId: 'Villain', text: 'Wait!' }]
  }, [{ characterId: 'Foxy' }]);
  assert.ok(result.issues.some(issue => issue.code === 'missing-character-reference' && issue.characterId === 'Snowball'));
  assert.ok(result.issues.some(issue => issue.code === 'dialogue-speaker-not-in-scene' && issue.characterId === 'Villain'));
});

test('production scene preserves invalid raw duration as a readiness issue after normalization', () => {
  const prepared = buildProductionScene({
    title: 'A scene', visibleAction: 'A bird lands.', camera: 'Wide shot', durationSeconds: 99
  });
  assert.equal(prepared.durationSeconds, 3);
  assert.ok(prepared.productionReadiness.issues.some(issue => issue.code === 'invalid-duration'));
});


test('motion prompt serializes validated character action phases with scene-relative seconds', () => {
  const timelineScene = {
    ...scene,
    storyDetail: 'Foxy notices the key, turns the key, and the gate opens.',
    durationSeconds: 4,
    actionTimeline: {
      schemaVersion: 1,
      phases: [
        { phase: 'preparation', start: 0, end: 0.2, actorId: 'foxy', description: 'Foxy notices and prepares to turn the key.', evidence: 'Foxy notices the key' },
        { phase: 'action', start: 0.2, end: 0.65, actorId: 'foxy', targetId: 'gate lock', description: 'Foxy turns the key in the lock.', evidence: 'turns the key' },
        { phase: 'reaction', start: 0.65, end: 0.82, actorId: 'foxy', description: 'Foxy watches as the gate responds.', evidence: 'the gate opens' },
        { phase: 'result', start: 0.82, end: 1, actorId: 'foxy', description: 'The gate remains open.', evidence: 'the gate opens' }
      ]
    }
  };
  const prompt = buildMotionGenerationPrompt(timelineScene);
  assert.match(prompt, /Character action timeline/);
  assert.match(prompt, /preparation \(0%-20%; 0\.00-0\.80s\)/);
  assert.match(prompt, /action \(20%-65%; 0\.80-2\.60s\)/);
  assert.match(prompt, /reaction/);
  assert.match(prompt, /result/);
});

test('production readiness rejects malformed supplied action timelines', () => {
  const result = validateSceneProductionReadiness({
    ...scene,
    storyDetail: 'Foxy turns the key.',
    actionTimeline: {
      schemaVersion: 1,
      phases: [{ phase: 'reaction', start: 0, end: 1, actorId: 'foxy', description: 'Foxy reacts.', evidence: 'Foxy turns the key.' }]
    }
  });
  assert.equal(result.ready, false);
  assert.ok(result.issues.some(issue => issue.code === 'invalid-action-timeline'));
});


test('image and motion prompts preserve dedicated character identity anchors', () => {
  const detailedProfile = {
    characterId: 'Foxy',
    species: 'Anthropomorphic fox',
    ageRange: 'Young adult',
    visualDescription: 'Small orange fox',
    bodyShape: 'Small and agile',
    hair: 'Short swept-back auburn hair',
    eyeColor: 'Amber',
    silhouette: 'Large ears and bushy tail',
    clothing: 'Blue scarf',
    signatureAccessories: 'Brass pendant',
    distinctiveFeatures: 'White tail tip'
  };
  const promptScene = { imagePrompt: 'Foxy stands by the gate.', visibleAction: 'Foxy waves.', characters: ['Foxy'] };
  const imagePrompt = buildImageGenerationPrompt(promptScene, [detailedProfile]);
  const motionPrompt = buildMotionGenerationPrompt(promptScene, [detailedProfile]);
  for (const detail of ['Anthropomorphic fox', 'Young adult', 'Small and agile', 'Short swept-back auburn hair', 'Amber', 'Large ears and bushy tail', 'Brass pendant']) {
    assert.match(imagePrompt, new RegExp(detail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(motionPrompt, new RegExp(detail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

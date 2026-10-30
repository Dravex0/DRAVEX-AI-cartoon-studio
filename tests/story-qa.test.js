import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScene, normalizeScenes } from '../src/scene-model.js';
import { validateStoryScenes } from '../src/story-qa.js';
import { asterAwakening } from '../fixtures/aster-awakening.js';

test('normalizes legacy scene fields without losing prompt, motion, camera, or 2-second duration', () => {
  const scene = normalizeScene({ id: 'legacy-1', title: 'Eyes change', prompt: 'Aster reacts.', motion: 'His iris darkens.', camera: 'Close-up', duration: 2 });
  assert.equal(scene.id, 'legacy-1'); assert.equal(scene.visibleAction, 'His iris darkens.');
  assert.equal(scene.durationSeconds, 2); assert.equal(scene.camera, 'Close-up');
});
test('preserves separate image, motion, negative, and continuity prompts through normalization', () => {
  const scene = normalizeScene({
    imagePrompt: 'A fox holding a silver key in a moonlit forest.',
    motionPrompt: 'The fox raises the key and the gate opens.',
    negativePrompt: 'No extra characters.',
    continuityLock: 'Same orange fur and blue scarf.'
  });
  assert.match(scene.imagePrompt, /silver key/);
  assert.match(scene.motionPrompt, /gate opens/);
  assert.match(scene.negativePrompt, /No extra characters/);
  assert.match(scene.continuityLock, /blue scarf/);
});
test('normalizes malformed durations and bounds heuristic scores', () => {
  const scene = normalizeScene({ duration: 999, directorHeuristicScore: 150 }, 2);
  assert.equal(scene.durationSeconds, 3); assert.equal(scene.id, 'scene_3'); assert.equal(scene.directorHeuristicScore, 100);
});
test('accepts non-array input as an empty scene list', () => {
  assert.deepEqual(normalizeScenes(null), []); assert.equal(validateStoryScenes([]).issues[0].code, 'no-scenes');
});
test('Aster fixture has eight distinct scenes totalling 23 seconds', () => {
  const result = validateStoryScenes(asterAwakening);
  assert.equal(result.sceneCount, 8); assert.equal(result.totalDurationSeconds, 23);
  assert.equal(result.errorCount, 0); assert.equal(result.ok, true);
  assert.equal(result.issues.some((entry) => entry.code === 'adjacent-repeat'), false);
});
test('flags vague action and missing visual direction', () => {
  const result = validateStoryScenes([{ id: 'vague', duration: 3, motion: 'Stands there.' }, { id: 'empty', duration: 3 }]);
  assert.ok(result.issues.some((entry) => entry.code === 'vague-action' && entry.sceneId === 'vague'));
  assert.ok(result.issues.some((entry) => entry.code === 'missing-visual-direction' && entry.sceneId === 'empty'));
  assert.equal(result.ok, false);
});
test('flags near-identical consecutive prompts', () => {
  const prompt = 'A red car drives quickly through a narrow city street at night with bright lights.';
  const result = validateStoryScenes([{ id: 'a', duration: 3, prompt }, { id: 'b', duration: 3, prompt }]);
  assert.ok(result.issues.some((entry) => entry.code === 'adjacent-repeat' && entry.otherSceneId === 'a'));
});
test('flags repeated adjacent actions even when visual prompts differ', () => {
  const visibleAction = 'Aster slowly turns his head toward the doorway.';
  const result = validateStoryScenes([
    { id: 'action-a', duration: 3, prompt: 'Moonlight spills across the ancient cathedral columns.', visibleAction },
    { id: 'action-b', duration: 3, prompt: 'Blue magical sparks illuminate the ruined stone floor.', visibleAction }
  ]);
  assert.ok(result.issues.some((entry) => entry.code === 'adjacent-repeat' && entry.sceneId === 'action-b' && entry.otherSceneId === 'action-a'));
});
test('flags repeated non-adjacent actions even when visual prompts differ', () => {
  const visibleAction = 'Aster slowly turns his head toward the doorway.';
  const result = validateStoryScenes([
    { id: 'action-a', duration: 3, prompt: 'Moonlight spills across the ancient cathedral columns.', visibleAction },
    { id: 'action-b', duration: 3, prompt: 'Aster touches the glowing symbol and pulls his hand away.', visibleAction: 'Aster kneels and touches the symbol.' },
    { id: 'action-c', duration: 3, prompt: 'Blue magical sparks illuminate the ruined stone floor.', visibleAction }
  ]);
  assert.ok(result.issues.some((entry) => entry.code === 'repeated-content' && entry.sceneId === 'action-c' && entry.otherSceneId === 'action-a'));
});
test('flags repeated adjacent camera framing when shot descriptions use different wording', () => {
  const result = validateStoryScenes([
    { id: 'close-a', duration: 3, prompt: 'Aster notices a silver symbol.', motion: 'His fingers tremble.', camera: 'Close-up on his hand' },
    { id: 'close-b', duration: 3, prompt: 'Aster looks toward the doorway.', motion: 'His eyes shift left.', camera: 'Slow close up, slight push-in' }
  ]);
  assert.ok(result.issues.some((entry) => entry.code === 'camera-shot-repeat' && entry.sceneId === 'close-b' && entry.otherSceneId === 'close-a'));
});
test('does not treat extreme close-up and macro close-up as the same shot size', () => {
  const result = validateStoryScenes([
    { id: 'macro', duration: 3, prompt: 'A mark glows.', motion: 'Silver cracks spread.', camera: 'Macro close-up' },
    { id: 'extreme', duration: 3, prompt: 'Aster reacts.', motion: 'His iris darkens.', camera: 'Extreme close-up' }
  ]);
  assert.equal(result.issues.some((entry) => entry.code === 'camera-shot-repeat'), false);
});

test('recognizes repeated Russian and Ukrainian wide camera framing', () => {
  const result = validateStoryScenes([
    { id: 'wide-ru', duration: 3, prompt: 'A fox discovers a lantern.', motion: 'The fox approaches the lantern.', camera: 'Общий план лесной поляны' },
    { id: 'wide-uk', duration: 3, prompt: 'A rabbit opens a gate.', motion: 'The rabbit pushes the gate open.', camera: 'Загальний план біля воріт' }
  ]);
  assert.ok(result.issues.some((entry) => entry.code === 'camera-shot-repeat' && entry.sceneId === 'wide-uk'));
});

test('distinguishes Russian close-up from extreme close-up', () => {
  const result = validateStoryScenes([
    { id: 'close-ru', duration: 3, prompt: 'Aster reacts to a sound.', motion: 'His expression changes.', camera: 'Крупный план лица' },
    { id: 'extreme-ru', duration: 3, prompt: 'A silver rune activates.', motion: 'A tiny crack emits light.', camera: 'Экстремально крупный план руны' }
  ]);
  assert.equal(result.issues.some((entry) => entry.code === 'camera-shot-repeat'), false);
});

test('normalizes invalid duration and reports correction', () => {
  const result = validateStoryScenes([{ id: 'too-long', duration: 60, prompt: 'A bird flies over a lake.' }]);
  assert.equal(result.totalDurationSeconds, 3); assert.ok(result.issues.some((entry) => entry.code === 'duration-normalized'));
});
test('flags duplicate scene IDs', () => {
  const result = validateStoryScenes([{ id: 'same-id', duration: 3, prompt: 'Aster enters the ruined cathedral.' }, { id: 'same-id', duration: 3, prompt: 'Aster touches the glowing symbol.' }]);
  assert.ok(result.issues.some((entry) => entry.code === 'duplicate-scene-id' && entry.severity === 'error'));
  assert.equal(result.ok, false);
});
test('flags dialogue speakers not assigned to scene', () => {
  const result = validateStoryScenes([{ id: 'd1', duration: 3, prompt: 'Aster turns toward the doorway.', characters: ['aster'], dialogue: [{ characterId: 'unknown-character', text: 'Who is there?', language: 'en' }] }]);
  assert.ok(result.issues.some((entry) => entry.code === 'dialogue-speaker-not-in-scene'));
});
test('accepts dialogue speaker assigned to scene', () => {
  const result = validateStoryScenes([{ id: 'd2', duration: 3, prompt: 'Aster turns toward the doorway.', characters: ['aster'], dialogue: [{ characterId: 'aster', text: 'Who is there?', language: 'en' }] }]);
  assert.equal(result.issues.some((entry) => entry.code === 'dialogue-speaker-not-in-scene'), false);
});
test('warns when dialogue speaker cannot be checked against scene characters', () => {
  const result = validateStoryScenes([{ id: 'd3', duration: 3, prompt: 'Aster opens the old door.', dialogue: [{ characterId: 'aster', text: 'Who is there?', language: 'en' }] }]);
  assert.ok(result.issues.some((entry) => entry.code === 'dialogue-character-list-missing'));
});
test('does not warn when speaker is present in scene character list', () => {
  const result = validateStoryScenes([{ id: 'd4', duration: 3, prompt: 'Aster opens the old door.', characters: ['aster'], dialogue: [{ characterId: 'aster', text: 'Who is there?', language: 'en' }] }]);
  assert.equal(result.issues.some((entry) => entry.code === 'dialogue-character-list-missing' || entry.code === 'dialogue-speaker-not-in-scene'), false);
});
test('handles Symbol duration without throwing', () => {
  const scene = normalizeScene({ duration: Symbol('bad') });
  assert.equal(scene.durationSeconds, 3);
  const result = validateStoryScenes([{ id: 'symbol-duration', duration: Symbol('bad'), prompt: 'A cat jumps onto a chair.' }]);
  assert.equal(result.totalDurationSeconds, 3);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPromptApproach, classifyPromptApproach } from '../src/prompt-approach.js';
import { buildStoryboardFromText } from '../src/storyboard-generator.js';

test('routes combat prompts to readable action choreography', () => {
  const approach = classifyPromptApproach('The knight attacks the monster, dodges a punch and strikes back.');
  assert.equal(approach.primary, 'combat');
  assert.match(approach.cameraGuidance, /wide geography/i);
  assert.ok(approach.priorities.some(value => /anticipation/i.test(value)));
});

test('recognizes Russian and Ukrainian prompts with Unicode word boundaries', () => {
  assert.equal(classifyPromptApproach('Лисёнок убегает от монстра, а тот преследует его.').primary, 'chase');
  assert.equal(classifyPromptApproach('Рыцарь сражается с драконом.').primary, 'combat');
  assert.equal(classifyPromptApproach('Девочка шепчет другу и спрашивает дорогу.').primary, 'dialogue');
  assert.equal(classifyPromptApproach('Герой танцует на сцене.').primary, 'dance');
  assert.equal(classifyPromptApproach('Герой досліджує старий замок.').primary, 'discovery');
});

test('supports mixed prompts without collapsing every scene into one generic strategy', () => {
  const approach = classifyPromptApproach('The hero discovers a portal, then escapes from a monster.');
  assert.equal(approach.primary, 'chase');
  assert.ok(approach.strategies.includes('discovery'));
  assert.ok(approach.strategies.includes('horror'));
});

test('uses a source-faithful general strategy when no category is supported', () => {
  const approach = classifyPromptApproach('A quiet landscape at sunrise.');
  assert.equal(approach.primary, 'general');
  assert.match(approach.priorities.join(' '), /do not invent/i);
});

test('adds directing guidance without changing source events or character membership', () => {
  const sourceScene = { storyDetail: 'The knight attacks the gate guard.', characters: ['Knight', 'Guard'], motionPrompt: 'Knight attacks the guard.' };
  const approach = classifyPromptApproach(sourceScene.storyDetail);
  const result = applyPromptApproach(sourceScene, approach);
  assert.deepEqual(result.characters, sourceScene.characters);
  assert.equal(result.storyDetail, sourceScene.storyDetail);
  assert.equal(result.promptApproach.primary, 'combat');
  assert.match(result.motionPrompt, /Prompt-specific directing approach/);
  assert.match(result.motionPrompt, /do not add actions/i);
  assert.match(result.camera, /wide geography/i);
});

test('assigns a separate approach to each storyboard scene', () => {
  const result = buildStoryboardFromText(
    'Scene 1: The discovery\nThe girl discovers a hidden key.\n\nScene 2: The escape\nThe girl runs away from the monster.',
    'en',
    'Girl'
  );
  assert.equal(result.scenes[0].promptApproach.primary, 'discovery');
  assert.equal(result.scenes[1].promptApproach.primary, 'chase');
  assert.equal(result.promptApproach.primary, 'chase');
  assert.match(result.scenes[0].motionGenerationPrompt, /investigation/i);
  assert.match(result.scenes[1].motionGenerationPrompt, /pursuit/i);
});

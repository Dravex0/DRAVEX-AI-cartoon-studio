import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneBackgroundPrompt } from '../src/scene-background-prompt.js';

test('builds an environment-only prompt from explicit setting fields', () => {
  const result = buildSceneBackgroundPrompt({
    environmentDescription: 'A quiet stone courtyard with a fountain and flowering vines.',
    location: 'Old palace garden',
    timeOfDay: 'Early morning',
    weather: 'Light mist',
    environmentLighting: 'Soft warm sunlight',
    environmentStyle: 'Hand-painted anime background'
  });
  assert.equal(result.ready, true);
  assert.equal(result.assetRole, 'scene-background');
  assert.equal(result.compositionStatus, 'unverified');
  assert.match(result.prompt, /stone courtyard/);
  assert.match(result.prompt, /Old palace garden/);
  assert.match(result.prompt, /Do not render people, characters, animals/);
  assert.match(result.prompt, /clear usable foreground space/);
});

test('does not copy character, story, action, dialogue, or character-aware prompt data', () => {
  const result = buildSceneBackgroundPrompt({
    environmentDescription: 'A moonlit forest clearing.',
    location: 'Forest',
    characters: ['Foxy', 'Bird'],
    characterBible: [{ characterId: 'Foxy', visualDescription: 'Bright orange fox' }],
    visibleAction: 'Foxy hugs Bird.',
    actionTimeline: { phases: [{ actorId: 'Foxy', description: 'Foxy hugs Bird.' }] },
    dialogue: [{ characterId: 'Foxy', text: 'Hello, Bird!' }],
    storyDetail: 'Foxy meets Bird.',
    imagePrompt: 'Foxy and Bird stand in a forest.',
    prompt: 'Foxy, the orange fox, waves.',
    description: 'Two characters greet each other.',
    camera: 'Close-up of Foxy.',
    continuityLock: 'Keep Foxy orange.'
  });
  assert.equal(result.ready, true);
  for (const forbidden of ['Foxy', 'Bird', 'orange fox', 'hugs', 'Hello', 'Close-up']) {
    assert.equal(result.prompt.includes(forbidden), false, 'background prompt must not include ' + forbidden);
  }
  assert.ok(result.excludedInputs.includes('characterBible'));
  assert.equal(result.compositionStatus, 'unverified');
});

test('reports missing environment information instead of falling back to story or character prompts', () => {
  const result = buildSceneBackgroundPrompt({
    imagePrompt: 'A fox in a forest.',
    storyDetail: 'A fox enters the forest.',
    characters: ['Foxy']
  });
  assert.deepEqual(result, {
    ready: false,
    prompt: '',
    compositionStatus: 'unverified',
    issues: [{ code: 'missing-environment-description' }]
  });
});

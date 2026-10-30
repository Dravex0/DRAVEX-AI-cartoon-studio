import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareStoryCharacterContext } from '../src/story-character-context.js';

test('prepares the character bible and assigns named characters to their source scenes', () => {
  const plan = {
    brief: {
      characterProfiles: [
        { characterId: 'Foxy', visualDescription: 'Small orange fox with a blue scarf' },
        { characterId: 'Snowball', visualDescription: 'White rabbit with long ears' }
      ]
    },
    scenes: [
      { id: 'scene_1', storyDetail: 'Foxy meets Snowball beside the river.' },
      { id: 'scene_2', storyDetail: 'Snowball helps Foxy cross the stream.' },
      { id: 'scene_3', storyDetail: 'The lantern lights the forest path.' }
    ]
  };
  const result = prepareStoryCharacterContext(plan, [], 'Foxy', 'en');

  assert.deepEqual(result.characterBible.map(profile => profile.characterId), ['Foxy', 'Snowball']);
  assert.deepEqual(result.scenes[0].characters, ['Foxy', 'Snowball']);
  assert.deepEqual(result.scenes[1].characters, ['Foxy', 'Snowball']);
  assert.equal(result.scenes[1].interaction.type, 'help');
  assert.equal(result.scenes[1].interaction.actorId, 'Snowball');
  assert.equal(result.scenes[1].interaction.targetId, 'Foxy');
  assert.deepEqual(result.scenes[2].characters, ['Foxy']);
});

test('keeps user-approved profiles ahead of extracted descriptions', () => {
  const plan = {
    brief: { characterProfiles: [{ characterId: 'foxy', visualDescription: 'Weak automatic guess' }] },
    scenes: [{ id: 'scene_1', storyDetail: 'Foxy runs home.' }]
  };
  const result = prepareStoryCharacterContext(
    plan,
    [{ characterId: 'Foxy', visualDescription: 'User-approved fox', clothing: 'Blue scarf' }],
    'Foxy',
    'en'
  );

  assert.equal(result.characterBible.length, 1);
  assert.equal(result.characterBible[0].visualDescription, 'User-approved fox');
  assert.equal(result.characterBible[0].clothing, 'Blue scarf');
});

test('does not throw when the character library is full and protagonist is not saved', () => {
  const existing = Array.from({ length: 20 }, (_, index) => ({ characterId: 'Saved' + index }));
  const result = prepareStoryCharacterContext(
    { brief: { characterProfiles: [] }, scenes: [{ storyDetail: 'A quiet forest.' }] },
    existing,
    'Foxy',
    'en'
  );

  assert.equal(result.characterBible.length, 20);
  assert.deepEqual(result.scenes[0].characters, ['Foxy']);
});

test('handles missing plan fields without inventing scene content', () => {
  const result = prepareStoryCharacterContext(null, [], '', 'en');
  assert.deepEqual(result, { characterBible: [], scenes: [] });
});

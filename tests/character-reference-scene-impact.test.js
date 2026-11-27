import test from 'node:test';
import assert from 'node:assert/strict';
import { findSceneIndexesUsingCharacterReference } from '../src/character-reference-scene-impact.js';

test('matches explicit scene casts case-insensitively and preserves storyboard indexes', () => {
  const scenes = [
    { characters: ['Foxy'] },
    { characters: ['Mira', 'FOXy'] },
    { characters: ['Bird'] },
    { characters: [] }
  ];
  assert.deepEqual(findSceneIndexesUsingCharacterReference(scenes, 'foxy'), [0, 1]);
});

test('includes legacy scenes without an explicit cast and parses string casts without invalidating unrelated scenes', () => {
  const scenes = [
    { title: 'Legacy scene' },
    { characters: ['Foxy'] },
    { characters: [] },
    { characters: 'Foxy' },
    { characters: 'Mira, Foxy' },
    { characters: 'Mira' },
    { characters: '' },
    { characters: null }
  ];
  assert.deepEqual(findSceneIndexesUsingCharacterReference(scenes, 'Foxy'), [0, 1, 3, 4, 6, 7]);
});

test('returns no scene indexes for an empty character ID or invalid scene list', () => {
  assert.deepEqual(findSceneIndexesUsingCharacterReference([{ characters: ['Foxy'] }], ''), []);
  assert.deepEqual(findSceneIndexesUsingCharacterReference(null, 'Foxy'), []);
});

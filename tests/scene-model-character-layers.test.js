import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScene } from '../src/scene-model.js';

test('scene normalization preserves validated independent character layers', () => {
  const scene = normalizeScene({
    title: 'Two characters',
    characters: ['Foxy', 'Bird'],
    characterLayers: [
      { characterId: 'Foxy', imageUrl: 'blob:foxy', x: 0.3, y: 0.6, zIndex: 1 },
      { characterId: 'Bird', imageUrl: 'blob:bird', x: 0.7, y: 0.4, zIndex: 2 }
    ]
  });
  assert.deepEqual(scene.characters, ['Foxy', 'Bird']);
  assert.equal(scene.characterLayers.length, 2);
  assert.equal(scene.characterLayers[0].characterId, 'Foxy');
  assert.equal(scene.characterLayers[1].characterId, 'Bird');
});

test('legacy scenes without character layers normalize to an empty layer list', () => {
  assert.deepEqual(normalizeScene({ characters: ['Foxy'] }).characterLayers, []);
});

test('scene normalization rejects duplicate or incomplete character layer records', () => {
  const scene = normalizeScene({
    characterLayers: [
      { characterId: 'Foxy', imageUrl: 'blob:one' },
      { characterId: 'foxy', imageUrl: 'blob:duplicate' },
      { characterId: 'Bird' }
    ]
  });
  assert.equal(scene.characterLayers.length, 1);
  assert.equal(scene.characterLayers[0].imageUrl, 'blob:one');
});

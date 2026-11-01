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


test('scene normalization preserves editor-authored character motion keyframes', () => {
  const scene = normalizeScene({
    characterLayers: [{ characterId: 'Foxy', imageUrl: 'https://example.com/fox.png' }],
    characterMotionTimeline: {
      schemaVersion: 1,
      phases: [{
        phase: 'action', actorId: 'Foxy', start: 0.2, end: 0.8,
        motion: { from: { x: 0.2, y: 0.7 }, to: { x: 0.8, y: 0.3, scale: 1.5 } }
      }]
    }
  });
  assert.equal(scene.characterMotionTimeline.schemaVersion, 1);
  assert.equal(scene.characterMotionTimeline.phases[0].actorId, 'Foxy');
  assert.deepEqual(scene.characterMotionTimeline.phases[0].motion.to, { x: 0.8, y: 0.3, scale: 1.5 });
});

test('legacy scenes without editor-authored motion remain unchanged', () => {
  const scene = normalizeScene({ title: 'Legacy scene' });
  assert.equal(scene.characterMotionTimeline, null);
});

test('scene normalization preserves rig definitions and bounded pose metadata', () => {
  const scene = normalizeScene({
    characterRigs: [{
      schemaVersion: 1,
      characterId: 'Foxy',
      bones: [{ id: 'root', parentId: null }],
      parts: [{
        id: 'body', boneId: 'root', imageUrl: 'https://cdn.example.test/body.png',
        x: 0.5, y: 0.5, width: 0.3, height: 0.5
      }]
    }],
    characterRigPoses: { Foxy: { root: { x: 0.1, y: -0.1, rotation: 0.2 } } }
  });
  assert.equal(scene.characterRigs.length, 1);
  assert.equal(scene.characterRigs[0].characterId, 'Foxy');
  assert.deepEqual(scene.characterRigPoses, { Foxy: { root: { x: 0.1, y: -0.1, rotation: 0.2 } } });
});

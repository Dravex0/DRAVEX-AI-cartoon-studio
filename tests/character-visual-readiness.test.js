import test from 'node:test';
import assert from 'node:assert/strict';
import { countScenesMissingCharacterVisuals } from '../src/character-visual-readiness.js';

test('does not treat a generated scene background as a character visual', () => {
  const scene = {
    characters: ['Foxy'],
    generatedImageUrl: 'blob:forest-background'
  };
  assert.equal(countScenesMissingCharacterVisuals([scene], { protagonistId: 'Foxy' }), 1);
});

test('does not let another cast member sprite satisfy the protagonist requirement', () => {
  const scene = {
    characters: ['Foxy', 'Owl'],
    characterLayers: [{ characterId: 'Owl', imageUrl: 'blob:owl-sprite', visible: true }]
  };
  assert.equal(countScenesMissingCharacterVisuals([scene], { protagonistId: 'Foxy' }), 1);
});

test('accepts a visible sprite that matches the required protagonist', () => {
  const scene = {
    characters: ['Foxy'],
    characterLayers: [{ characterId: 'Foxy', imageUrl: 'blob:fox-sprite', visible: true }]
  };
  assert.equal(countScenesMissingCharacterVisuals([scene], { protagonistId: 'Foxy' }), 0);
});

test('accepts a validated image-backed rig for the required character', () => {
  const scene = {
    characters: ['Foxy'],
    characterRigs: [{
      schemaVersion: 1,
      characterId: 'Foxy',
      bones: [{ id: 'root' }],
      parts: [{ id: 'body', boneId: 'root', imageUrl: 'https://example.com/body.png',
        x: 0.5, y: 0.5, width: 0.3, height: 0.4 }]
    }]
  };
  assert.equal(countScenesMissingCharacterVisuals([scene], { protagonistId: 'Foxy' }), 0);
});

test('the procedural fallback covers only the protagonist, not missing secondary cast members', () => {
  const singleCharacterScene = { characters: ['Foxy'] };
  const twoCharacterScene = { characters: ['Foxy', 'Owl'] };
  assert.equal(countScenesMissingCharacterVisuals([singleCharacterScene], {
    protagonistId: 'Foxy', proceduralFallback: true
  }), 0);
  assert.equal(countScenesMissingCharacterVisuals([twoCharacterScene], {
    protagonistId: 'Foxy', proceduralFallback: true
  }), 1);
});

test('does not accept a cached full-scene video as proof that the cast is visible', () => {
  const scene = {
    characters: ['Foxy'],
    generatedImageUrl: 'blob:forest-background',
    generatedVideoUrl: 'blob:forest-video'
  };
  assert.equal(countScenesMissingCharacterVisuals([scene], {
    protagonistId: 'Foxy',
    // Legacy callers must not be able to bypass character evidence with a video flag.
    hasSceneVideo: () => true
  }), 1);
});

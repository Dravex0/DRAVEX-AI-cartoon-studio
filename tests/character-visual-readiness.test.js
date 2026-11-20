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

test('accepts a cached full-scene video as the visual scene resource', () => {
  const scene = { characters: ['Foxy'], generatedImageUrl: 'blob:forest-background' };
  assert.equal(countScenesMissingCharacterVisuals([scene], {
    protagonistId: 'Foxy',
    hasSceneVideo: () => true
  }), 0);
});


test('accepts a procedural fallback only for cast members explicitly confirmed renderable', () => {
  const scene = { characters: ['Kael', 'Wolf'] };
  assert.equal(countScenesMissingCharacterVisuals([scene], {
    protagonistId: 'Kael',
    canDrawProceduralCharacter: characterId => characterId === 'Kael'
  }), 1);
  assert.equal(countScenesMissingCharacterVisuals([scene], {
    protagonistId: 'Kael',
    canDrawProceduralCharacter: characterId => ['Kael', 'Wolf'].includes(characterId)
  }), 0);
});

test('passes the exact scene and index to procedural readiness checks', () => {
  const scenes = [{ characters: ['Kael'] }, { characters: ['Nox'] }];
  const seen = [];
  const missing = countScenesMissingCharacterVisuals(scenes, {
    canDrawProceduralCharacter: (characterId, scene, index) => {
      seen.push({ characterId, scene, index });
      return index === 0 && characterId === 'Kael';
    }
  });
  assert.equal(missing, 1);
  assert.equal(seen.length, 2);
  assert.equal(seen[0].scene, scenes[0]);
  assert.equal(seen[0].index, 0);
  assert.equal(seen[1].scene, scenes[1]);
  assert.equal(seen[1].index, 1);
});

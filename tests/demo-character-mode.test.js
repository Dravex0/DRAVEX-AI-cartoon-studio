import test from 'node:test';
import assert from 'node:assert/strict';
import { isProceduralFoxCharacter, shouldShowProceduralDemoCharacter } from '../src/demo-character-mode.js';

test('shows the built-in character when the story has no selected protagonist', () => {
  assert.equal(shouldShowProceduralDemoCharacter({ storyUsesFallback: true }), true);
});

test('does not replace a character supplied with actual scene layers', () => {
  assert.equal(shouldShowProceduralDemoCharacter({ storyUsesFallback: true, hasCharacterLayers: true }), false);
});

test('does not show the built-in character when the user selected a protagonist', () => {
  assert.equal(shouldShowProceduralDemoCharacter({ storyUsesFallback: false }), false);
});

test('recognizes a named Foxy profile for the built-in fallback renderer', () => {
  assert.equal(isProceduralFoxCharacter({ characterId: 'Foxy' }), true);
  assert.equal(isProceduralFoxCharacter({ characterId: 'Foxy', visualDescription: 'a small orange fox' }), true);
});

test('recognizes Russian and Ukrainian fox descriptions', () => {
  assert.equal(isProceduralFoxCharacter({ characterId: 'Лисёнок', visualDescription: 'маленький оранжевый лисёнок' }), true);
  assert.equal(isProceduralFoxCharacter({ characterId: 'Рыжик', species: 'лисиця' }), true);
});

test('does not substitute the fox renderer for a profile with an explicit non-fox species', () => {
  assert.equal(isProceduralFoxCharacter({ characterId: 'Foxy', species: 'robot', visualDescription: 'metallic blue robot' }), false);
  assert.equal(isProceduralFoxCharacter({ characterId: 'Bluebird', visualDescription: 'a small blue bird' }), false);
});

test('does not treat a Foxy-named robot as a fox when its appearance describes a robot', () => {
  assert.equal(isProceduralFoxCharacter({ characterId: 'Foxy', visualDescription: 'a small blue robot with glowing eyes' }), false);
  assert.equal(isProceduralFoxCharacter({ characterId: 'Foxy', distinctiveFeatures: 'metallic android body' }), false);
});

test('keeps an explicitly described fox eligible even when its profile contains a secondary non-fox term', () => {
  // The species field is the canonical identity source when present.
  assert.equal(isProceduralFoxCharacter({ characterId: 'Foxy', species: 'fox', visualDescription: 'a small robotic fox' }), true);
});

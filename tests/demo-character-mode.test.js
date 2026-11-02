import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowProceduralDemoCharacter } from '../src/demo-character-mode.js';

test('shows the built-in character when the story has no selected protagonist', () => {
  assert.equal(shouldShowProceduralDemoCharacter({ storyUsesFallback: true }), true);
});

test('does not replace a character supplied with actual scene layers', () => {
  assert.equal(shouldShowProceduralDemoCharacter({ storyUsesFallback: true, hasCharacterLayers: true }), false);
});

test('does not show the built-in character when the user selected a protagonist', () => {
  assert.equal(shouldShowProceduralDemoCharacter({ storyUsesFallback: false }), false);
});

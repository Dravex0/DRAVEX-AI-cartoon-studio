import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRenderCharacterLayers } from '../src/scene-character-composition.js';

test('character layers render over a procedural scene with no generated media', () => {
  assert.equal(shouldRenderCharacterLayers({ hasGeneratedMedia: false }), true);
});

test('character layers do not duplicate characters baked into generated full-frame media by default', () => {
  assert.equal(shouldRenderCharacterLayers({ hasGeneratedMedia: true }), false);
  assert.equal(shouldRenderCharacterLayers({
    hasGeneratedMedia: true,
    characterCompositionMode: 'auto'
  }), false);
  assert.equal(shouldRenderCharacterLayers({
    hasGeneratedMedia: true,
    characterCompositionMode: 'full-frame'
  }), false);
});

test('character layers may overlay generated media only when it is explicitly a background plate', () => {
  assert.equal(shouldRenderCharacterLayers({
    hasGeneratedMedia: true,
    characterCompositionMode: 'background-only'
  }), true);
});

test('unknown composition modes fail closed when generated media is present', () => {
  assert.equal(shouldRenderCharacterLayers({
    hasGeneratedMedia: true,
    characterCompositionMode: 'guess'
  }), false);
});

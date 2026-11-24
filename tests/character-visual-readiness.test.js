import test from 'node:test';
import assert from 'node:assert/strict';
import { countScenesMissingCharacterVisuals } from '../src/character-visual-readiness.js';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

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

test('does not count the disabled legacy demo-protagonist fallback as visible character artwork', () => {
  const scene = { characters: ['Foxy'] };
  assert.equal(countScenesMissingCharacterVisuals([scene], {
    protagonistId: 'Foxy',
    proceduralFallback: true
  }), 1);
});

test('does not treat a cached scene video as proof that the required character is visible', () => {
  const scene = { characters: ['Foxy'], generatedImageUrl: 'blob:forest-background' };
  assert.equal(countScenesMissingCharacterVisuals([scene], {
    protagonistId: 'Foxy',
    hasSceneVideo: () => true
  }), 1);
});

test('does not count local procedural actors when a cached video may suppress their renderer during export', () => {
  const scene = { characters: ['Foxy', 'Owl'] };
  assert.equal(countScenesMissingCharacterVisuals([scene], {
    protagonistId: 'Foxy',
    proceduralActors: true,
    hasSceneVideo: () => true
  }), 1);
});

test('does not accept a legacy demo-protagonist flag when a decoded clip suppresses that fallback', () => {
  const scene = { characters: ['Foxy'] };
  assert.equal(countScenesMissingCharacterVisuals([scene], {
    protagonistId: 'Foxy',
    proceduralFallback: true,
    hasSceneVideo: () => true
  }), 1);
});

test('accepts matching authored character art even when a cached scene video is present', () => {
  const scene = {
    characters: ['Foxy'],
    characterLayers: [{ characterId: 'Foxy', imageUrl: 'blob:fox-sprite', visible: true }]
  };
  assert.equal(countScenesMissingCharacterVisuals([scene], {
    protagonistId: 'Foxy',
    proceduralActors: true,
    hasSceneVideo: () => true
  }), 0);
});


test('counts the explicit offline Doodle renderer only when no decoded video suppresses it', () => {
  const scene = { characters: ['Foxy', 'Owl', 'Robot'] };
  assert.equal(countScenesMissingCharacterVisuals([scene], {
    protagonistId: 'Foxy', proceduralActors: true
  }), 0);
  assert.equal(countScenesMissingCharacterVisuals([scene], {
    protagonistId: 'Foxy',
    proceduralActors: true,
    hasSceneVideo: () => true
  }), 1);
});

test('still blocks a scene with no cast even when procedural actors are enabled', () => {
  assert.equal(countScenesMissingCharacterVisuals([{}], {
    protagonistId: '', proceduralActors: true
  }), 1);
});


test('uses decoded scene-video readiness to match the renderer suppression condition', () => {
  const helperStart = appSource.indexOf('function getMissingCharacterVisualCount(');
  const helperEnd = appSource.indexOf("$('makeFilm').addEventListener", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  const helper = appSource.slice(helperStart, helperEnd);
  assert.match(helper, /hasSceneVideo:\(scene,index\)=>Boolean\(sceneVideoCache\.get\(sceneVideoKey\(index,scene\)\)\?\.video\)/);
  assert.doesNotMatch(helper, /hasSceneVideo:\(scene,index\)=>Boolean\(sceneVideoCache/);
  assert.match(appSource, /const hasGeneratedVideo=isSceneVideoDecoded\(generatedVideo\)/);
  assert.match(appSource, /const proceduralActors=\$\('videoGenerationMode'\)\.value==='local-canvas'&&!hasGeneratedVideo/);
});

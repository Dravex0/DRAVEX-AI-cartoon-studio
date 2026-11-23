import test from 'node:test';
import assert from 'node:assert/strict';
import { hasRenderableCharacterLayer, hasRenderableCharacterRig, isProceduralFoxCharacter, resolveProceduralDemoCharacter, shouldShowProceduralDemoCharacter } from '../src/demo-character-mode.js';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

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
  assert.equal(isProceduralFoxCharacter({ characterId: 'Foxy', species: 'fox', visualDescription: 'a small robotic fox' }), true);
});


test('resolves the same procedural fallback for deterministic and local-AI storyboard plans', () => {
  assert.equal(resolveProceduralDemoCharacter({ requestedCharacter: '', protagonistId: 'Main character' }), true);
  assert.equal(resolveProceduralDemoCharacter({ requestedCharacter: 'Foxy', protagonistId: 'Foxy' }), true);
  assert.equal(resolveProceduralDemoCharacter({ requestedCharacter: 'Foxy', protagonistId: 'Foxy', protagonistProfile: { characterId: 'Foxy', species: 'robot' } }), false);
});

test('respects an explicit non-fox appearance when the protagonist uses the default placeholder name', () => {
  assert.equal(resolveProceduralDemoCharacter({
    requestedCharacter: '',
    protagonistId: 'Main character',
    protagonistProfile: {
      characterId: 'Main character',
      species: 'robot',
      visualDescription: 'a small blue robot with glowing eyes'
    }
  }), false);
  assert.equal(resolveProceduralDemoCharacter({
    requestedCharacter: '',
    protagonistId: 'Main character',
    protagonistProfile: {
      characterId: 'Main character',
      visualDescription: 'a small orange fox with a blue scarf'
    }
  }), true);
  assert.equal(resolveProceduralDemoCharacter({
    requestedCharacter: '',
    protagonistId: 'Main character'
  }), true);
});

test('recognizes a valid image-backed rig as a renderable character visual', () => {
  const rig = {
    schemaVersion: 1,
    characterId: 'Foxy',
    bones: [{ id: 'root' }],
    parts: [{ id: 'body', boneId: 'root', imageUrl: 'https://example.com/body.png', x: 0.5, y: 0.5, width: 0.3, height: 0.4 }]
  };
  assert.equal(hasRenderableCharacterRig({ characterRigs: [rig] }, 'Foxy'), true);
  assert.equal(hasRenderableCharacterRig({ characterRigs: [rig] }, 'Other'), false);
  assert.equal(hasRenderableCharacterRig({ characterRigs: [{ ...rig, parts: [{ ...rig.parts[0], imageUrl: 'javascript:alert(1)' }] }] }), false);
});

test('does not draw the fallback fox or assign its lip-sync when a matching body rig exists', () => {
  assert.equal(shouldShowProceduralDemoCharacter({ storyUsesFallback: true, hasCharacterRig: true }), false);
});

test('local-AI storyboard rebuilds preserve procedural fallback metadata and rig-aware rendering', () => {
  const runLocalModelStart = appSource.indexOf("$('runLocalModel').addEventListener('click'");
  const planUniversalStart = appSource.indexOf("$('planUniversalTask').addEventListener('click'", runLocalModelStart);
  const runLocalModelBlock = appSource.slice(runLocalModelStart, planUniversalStart);
  assert.ok(runLocalModelStart >= 0 && planUniversalStart > runLocalModelStart);
  assert.match(runLocalModelBlock, /resolveProceduralDemoCharacter\(/);
  assert.match(runLocalModelBlock, /proceduralDemoCharacter,/);
  assert.match(appSource, /hasCharacterRig:hasRenderableCharacterRig\(currentSceneData,currentStoryboardPlan\?\.sourceCharacter\|\|\$\('character'\)\.value\)/);
  assert.match(appSource, /countScenesMissingCharacterVisuals\(sceneMetadata/);
});


test('matches visible sprite layers to the protagonist instead of any cast member', () => {
  const scene = { characterLayers: [
    { characterId: 'Owl', imageUrl: 'https://example.com/owl.png', visible: true },
    { characterId: 'Foxy', imageUrl: 'https://example.com/fox.png', visible: false }
  ] };
  assert.equal(hasRenderableCharacterLayer(scene, 'Foxy'), false);
  assert.equal(hasRenderableCharacterLayer(scene, 'Owl'), true);
  assert.equal(shouldShowProceduralDemoCharacter({ storyUsesFallback: true, hasCharacterLayers: hasRenderableCharacterLayer(scene, 'Foxy') }), true);
});

test('keeps the procedural fallback above generated scene media', () => {
  const drawStart = appSource.indexOf('function draw(){');
  const drawEnd = appSource.indexOf('\nfunction ', drawStart + 1);
  assert.ok(drawStart >= 0 && drawEnd > drawStart, 'the scene draw function must exist');
  const drawBlock = appSource.slice(drawStart, drawEnd);
  const mediaDraw = drawBlock.indexOf('if(hasGeneratedVideo){drawImageCover');
  const fallbackDraw = drawBlock.indexOf('drawProceduralDemoFox(ctx');
  const characterLayersDraw = drawBlock.indexOf('drawCharacterLayers(ctx');
  assert.ok(mediaDraw >= 0, 'generated video or still media must be drawn');
  assert.ok(fallbackDraw > mediaDraw, 'the fallback character must be drawn after scene media');
  assert.ok(characterLayersDraw > fallbackDraw, 'generated character layers must remain above the fallback');
});

test('procedural fallback consumes source-ordered action timeline progress', () => {
  assert.match(appSource, /function getSceneAction\(index,progress=0\)/);
  assert.match(appSource, /detectSceneActionAtProgress\(sceneMetadata\[index\]\|\|\{\},progress/);
  assert.match(appSource, /getSceneAction\(sceneIndex,sceneMotionProgress\)/);
});


test('does not treat a fully transparent sprite as renderable or suppress the procedural fallback', () => {
  const scene = { characterLayers: [{
    characterId: 'Foxy',
    imageUrl: 'https://example.com/transparent-fox.png',
    visible: true,
    opacity: 0
  }] };
  const hasLayer = hasRenderableCharacterLayer(scene, 'Foxy');
  assert.equal(hasLayer, false);
  assert.equal(shouldShowProceduralDemoCharacter({ storyUsesFallback: true, hasCharacterLayers: hasLayer }), true);
});

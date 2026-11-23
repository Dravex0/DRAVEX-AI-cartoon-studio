import test from 'node:test';
import assert from 'node:assert/strict';
import { hasRenderableCharacterLayer, hasRenderableCharacterRig, resolveProceduralDemoCharacter, shouldShowProceduralDemoCharacter } from '../src/demo-character-mode.js';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

test('never substitutes a hard-coded fox when a storyboard has no character artwork', () => {
  assert.equal(resolveProceduralDemoCharacter({ requestedCharacter: '', protagonistId: 'Main character' }), false);
  assert.equal(resolveProceduralDemoCharacter({ requestedCharacter: 'Foxy', protagonistId: 'Foxy' }), false);
  assert.equal(shouldShowProceduralDemoCharacter({ storyUsesFallback: true }), false);
});

test('never substitutes a fox even when a fox is explicitly requested', () => {
  assert.equal(resolveProceduralDemoCharacter({ requestedCharacter: 'Foxy', protagonistId: 'Foxy', protagonistProfile: { characterId: 'Foxy', species: 'fox' } }), false);
  assert.equal(shouldShowProceduralDemoCharacter({ storyUsesFallback: true, hasCharacterLayers: false, hasCharacterRig: false }), false);
});

test('keeps valid image-backed character layers available for rendering', () => {
  const scene = { characterLayers: [
    { characterId: 'Owl', imageUrl: 'https://example.com/owl.png', visible: true },
    { characterId: 'Foxy', imageUrl: 'https://example.com/fox.png', visible: false }
  ] };
  assert.equal(hasRenderableCharacterLayer(scene, 'Owl'), true);
  assert.equal(hasRenderableCharacterLayer(scene, 'Foxy'), false);
});

test('recognizes a valid image-backed rig without enabling the demo fallback', () => {
  const rig = {
    schemaVersion: 1,
    characterId: 'Robot',
    bones: [{ id: 'root' }],
    parts: [{ id: 'body', boneId: 'root', imageUrl: 'https://example.com/body.png', x: 0.5, y: 0.5, width: 0.3, height: 0.4 }]
  };
  assert.equal(hasRenderableCharacterRig({ characterRigs: [rig] }, 'Robot'), true);
  assert.equal(hasRenderableCharacterRig({ characterRigs: [rig] }, 'Other'), false);
  assert.equal(shouldShowProceduralDemoCharacter({ storyUsesFallback: true, hasCharacterRig: true }), false);
});

test('local-AI storyboard rebuilds preserve the disabled fallback metadata path', () => {
  const runLocalModelStart = appSource.indexOf("$('runLocalModel').addEventListener('click'");
  const planUniversalStart = appSource.indexOf("$('planUniversalTask').addEventListener('click'", runLocalModelStart);
  const runLocalModelBlock = appSource.slice(runLocalModelStart, planUniversalStart);
  assert.ok(runLocalModelStart >= 0 && planUniversalStart > runLocalModelStart);
  assert.match(runLocalModelBlock, /resolveProceduralDemoCharacter\(/);
  assert.match(runLocalModelBlock, /proceduralDemoCharacter,/);
  assert.match(appSource, /shouldShowProceduralDemoCharacter\(/);
  assert.match(appSource, /hasCharacterRig:hasRenderableCharacterRig\(currentSceneData,currentStoryboardPlan\?\.sourceCharacter\|\|\$\('character'\)\.value\)/);
  assert.match(appSource, /countScenesMissingCharacterVisuals\(sceneMetadata/);
});


test('uses the shared offline Doodle renderer only in local-canvas mode and reuses production LipSync', () => {
  assert.match(appSource, /drawProceduralSceneActors\(ctx,currentSceneData/);
  assert.match(appSource, /proceduralActors\.layers/);
  assert.match(appSource, /facialVisemes:facialLipSync\.facialVisemes/);
  assert.match(appSource, /facialMouthOpenness:facialLipSync\.facialMouthOpenness/);
  assert.match(appSource, /proceduralActors:\$\('videoGenerationMode'\)\.value==='local-canvas'/);
  assert.ok(appSource.includes('...(proceduralActors.layers||[])],rigAnimationProgress'));
});

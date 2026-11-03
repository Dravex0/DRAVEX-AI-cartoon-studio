import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterRigTimelineFromActionTimeline } from '../src/character-rig-action-planner.js';
import { sampleCharacterRigTimeline } from '../src/character-rig-timeline.js';
import { drawCharacterLayers } from '../src/scene-character-layers.js';
import { buildCharacterRigAssetPlan } from '../src/character-rig-asset-plan.js';
import { createCharacterRigMotionPreset } from '../src/character-rig-motion-presets.js';

const rig = {
  schemaVersion: 1,
  characterId: 'Foxy',
  bones: [
    { id: 'root', parentId: null },
    { id: 'leftArm', parentId: 'root' },
    { id: 'rightArm', parentId: 'root' },
    { id: 'leftLeg', parentId: 'root' },
    { id: 'rightLeg', parentId: 'root' },
    { id: 'head', parentId: 'root' }
  ],
  parts: [
    { id: 'body', boneId: 'root', imageUrl: 'https://assets.example/body.png' },
    { id: 'arm-l', boneId: 'leftArm', imageUrl: 'https://assets.example/arm-l.png' },
    { id: 'arm-r', boneId: 'rightArm', imageUrl: 'https://assets.example/arm-r.png' },
    { id: 'leg-l', boneId: 'leftLeg', imageUrl: 'https://assets.example/leg-l.png' },
    { id: 'leg-r', boneId: 'rightLeg', imageUrl: 'https://assets.example/leg-r.png' },
    { id: 'head-part', boneId: 'head', imageUrl: 'https://assets.example/head.png' }
  ]
};

function createScene() {
  const evidence = 'Foxy dodges the incoming strike';
  return {
    characters: ['Foxy'],
    characterCastProvided: true,
    storyDetail: evidence,
    actionTimeline: {
      schemaVersion: 1,
      phases: [{
        phase: 'action',
        start: 0.2,
        end: 0.8,
        actorId: 'Foxy',
        targetId: null,
        description: evidence,
        evidence
      }]
    }
  };
}

function createCanvasSpy() {
  const calls = { rotations: [], draws: 0 };
  return {
    calls,
    context: {
      globalAlpha: 1,
      save() {},
      restore() {},
      translate() {},
      rotate(value) { calls.rotations.push(value); },
      scale() {},
      drawImage() { calls.draws++; }
    }
  };
}

test('story-generated rig poses reach the character renderer as articulated image transforms', () => {
  const planned = createCharacterRigTimelineFromActionTimeline(createScene(), [rig]);
  assert.equal(planned.status, 'generated');
  assert.equal(planned.generatedCount, 1);

  const sampledPoses = sampleCharacterRigTimeline(planned.timeline, 0.5);
  const spy = createCanvasSpy();
  const result = drawCharacterLayers(
    spy.context,
    [{ characterId: 'Foxy', imageUrl: 'https://assets.example/foxy.png' }],
    () => ({ width: 64, height: 64 }),
    640,
    360,
    {
      drawRigParts: true,
      preferRigParts: true,
      characterRigs: [rig],
      rigPoses: sampledPoses
    }
  );

  assert.equal(result.rigDrawn, rig.parts.length);
  assert.equal(result.rigSkipped, 0);
  assert.deepEqual(result.rigReadyCharacterIds, ['Foxy']);
  assert.equal(spy.calls.draws, rig.parts.length);
  assert.ok(spy.calls.rotations.some(rotation => Math.abs(rotation) > 0.5),
    'at least one rendered body part must receive the generated dodge rotation');
});

test('story-generated rig timeline renders neutral parts before the action interval', () => {
  const planned = createCharacterRigTimelineFromActionTimeline(createScene(), [rig]);
  const sampledPoses = sampleCharacterRigTimeline(planned.timeline, 0.1);
  const spy = createCanvasSpy();

  const result = drawCharacterLayers(
    spy.context,
    [{ characterId: 'Foxy', imageUrl: 'https://assets.example/foxy.png' }],
    () => ({ width: 64, height: 64 }),
    640,
    360,
    {
      drawRigParts: true,
      preferRigParts: true,
      characterRigs: [rig],
      rigPoses: sampledPoses
    }
  );

  assert.equal(result.rigDrawn, rig.parts.length);
  assert.ok(spy.calls.rotations.every(rotation => Math.abs(rotation) < 1e-9),
    'the character should remain neutral outside the story action interval');
});


test('generated ten-part rig walk timeline reaches all ten rendered sprite layers', () => {
  const plan = buildCharacterRigAssetPlan({
    characterId: 'Foxy',
    appearanceReference: 'Orange fox, cream muzzle, green scarf'
  });
  assert.equal(plan.status, 'ready_for_generation');
  const generatedRig = {
    ...plan.rig,
    parts: plan.rig.parts.map(part => ({
      ...part,
      imageUrl: 'https://assets.example/' + part.id + '.png'
    }))
  };
  const motion = createCharacterRigMotionPreset(generatedRig, 'walk');
  assert.equal(motion.status, 'ready');

  const renderAt = progress => {
    const sampledPoses = sampleCharacterRigTimeline(motion.timeline, progress).Foxy;
    const rotations = [];
    const spy = {
      save() {},
      restore() {},
      translate() {},
      rotate(value) { rotations.push(value); },
      drawImage() { rotations.push('draw'); }
    };
    const result = drawCharacterLayers(
      spy,
      [{ characterId: 'Foxy', imageUrl: 'https://assets.example/legacy-foxy.png' }],
      url => ({ width: 64, height: 64, src: url }),
      640,
      360,
      {
        drawRigParts: true,
        preferRigParts: true,
        characterRigs: [generatedRig],
        rigPoses: { Foxy: sampledPoses }
      }
    );
    return { result, rotations };
  };

  const leftStride = renderAt(0.25);
  const rightStride = renderAt(0.75);
  for (const rendered of [leftStride, rightStride]) {
    assert.equal(rendered.result.rigDrawn, 10);
    assert.equal(rendered.result.rigSkipped, 0);
    assert.deepEqual(rendered.result.rigReadyCharacterIds, ['Foxy']);
    assert.equal(rendered.rotations.filter(value => value === 'draw').length, 10);
    assert.ok(rendered.rotations.some(value => typeof value === 'number' && Math.abs(value) > 0.05),
      'animated bone rotations must reach the canvas renderer');
  }
  assert.notDeepEqual(leftStride.rotations, rightStride.rotations,
    'opposite walk phases must render different limb transforms');
});

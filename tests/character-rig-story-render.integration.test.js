import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterRigTimelineFromActionTimeline } from '../src/character-rig-action-planner.js';
import { sampleCharacterRigTimeline } from '../src/character-rig-timeline.js';
import { drawCharacterLayers } from '../src/scene-character-layers.js';

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

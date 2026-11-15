import test from 'node:test';
import { generateCharacterRigParts } from '../src/character-rig-part-generation.js';
import { reviewCharacterRigPart, assembleApprovedCharacterRig } from '../src/character-rig-part-review.js';
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

test('Kel freeing a named prop maps to a reaching arm pose that reaches the canvas renderer', () => {
  const kelRig = { ...rig, characterId: 'Kel' };
  const evidence = 'Kel carefully frees the small mechanical bird.';
  const scene = {
    characters: ['Kel'],
    characterCastProvided: true,
    storyDetail: evidence,
    actionTimeline: {
      schemaVersion: 1,
      phases: [{
        phase: 'action',
        start: 0.2,
        end: 0.8,
        actorId: 'Kel',
        targetId: 'small mechanical bird',
        description: evidence,
        evidence
      }]
    }
  };
  const planned = createCharacterRigTimelineFromActionTimeline(scene, [kelRig]);
  assert.equal(planned.status, 'generated');
  assert.equal(planned.mappedActions[0].preset, 'reach');

  const sampledPoses = sampleCharacterRigTimeline(planned.timeline, 0.5);
  const spy = createCanvasSpy();
  const rendered = drawCharacterLayers(
    spy.context,
    [{ characterId: 'Kel', imageUrl: 'https://assets.example/kel.png' }],
    () => ({ width: 64, height: 64 }),
    640,
    360,
    {
      drawRigParts: true,
      preferRigParts: true,
      characterRigs: [kelRig],
      rigPoses: sampledPoses
    }
  );

  assert.equal(rendered.rigDrawn, kelRig.parts.length);
  assert.equal(rendered.rigSkipped, 0);
  assert.ok(spy.calls.rotations.some(rotation => Math.abs(rotation) > 0.5),
    'the reaching arm pose must reach an actual rendered rig-part transform');
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


test('story-generated dance poses reach the canvas renderer as visible articulated limb transforms', () => {
  const evidence = 'Foxy dances to the music';
  const scene = {
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
  const planned = createCharacterRigTimelineFromActionTimeline(scene, [rig]);
  assert.equal(planned.status, 'generated');
  assert.equal(planned.mappedActions[0].preset, 'dance');

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
  assert.ok(spy.calls.rotations.some(rotation => Math.abs(rotation) > 0.2),
    'dance limb rotations must reach the actual canvas part transforms');
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


test('generated, reviewed ten-part assets assemble into an animated rig and reach the renderer', async () => {
  let generated = 0;
  const generation = await generateCharacterRigParts({
    characterId: 'Foxy',
    appearanceReference: 'Orange fox, cream muzzle, green scarf',
    consentAccepted: true,
    generateImage: async ({ seed }) => {
      generated++;
      return {
        imageUrl: 'https://assets.example.test/foxy-part-' + generated + '.png',
        requestId: 'foxy-' + generated,
        seed
      };
    }
  });

  assert.equal(generated, 10);
  assert.equal(generation.readyForAnimation, false);
  assert.equal(generation.assets.length, 10);

  const rgba = new Uint8ClampedArray(10 * 10 * 4);
  for (let pixel = 0; pixel < 100; pixel++) {
    const alpha = pixel < 20 ? 0 : 255;
    rgba[pixel * 4] = 255;
    rgba[pixel * 4 + 1] = 120;
    rgba[pixel * 4 + 2] = 40;
    rgba[pixel * 4 + 3] = alpha;
  }
  const reviews = generation.assets.map(asset => ({
    partId: asset.partId,
    review: reviewCharacterRigPart(asset, { data: rgba }, 10, 10, {
      correctPart: true,
      characterIdentity: true,
      jointAlignment: true
    })
  }));
  assert.ok(reviews.every(item => item.review.approved === true));

  const assembled = assembleApprovedCharacterRig({
    characterId: 'Foxy',
    rig: generation.rig,
    assets: generation.assets,
    reviews
  });
  assert.equal(assembled.status, 'approved');
  assert.equal(assembled.readyForAnimation, true);
  assert.equal(assembled.approvedPartCount, 10);
  assert.ok(assembled.rig.parts.every(part => part.imageUrl.startsWith('https://')));

  const motion = createCharacterRigMotionPreset(assembled.rig, 'walk');
  assert.equal(motion.status, 'ready');
  const poses = sampleCharacterRigTimeline(motion.timeline, 0.25);
  const spy = createCanvasSpy();
  const rendered = drawCharacterLayers(
    spy.context,
    [{ characterId: 'Foxy', imageUrl: 'https://assets.example.test/foxy-fallback.png' }],
    () => ({ width: 64, height: 64 }),
    640,
    360,
    {
      drawRigParts: true,
      preferRigParts: true,
      characterRigs: [assembled.rig],
      rigPoses: { Foxy: poses.Foxy }
    }
  );

  assert.equal(rendered.rigDrawn, 10);
  assert.equal(rendered.rigSkipped, 0);
  assert.deepEqual(rendered.rigReadyCharacterIds, ['Foxy']);
  assert.equal(spy.calls.draws, 10);
});

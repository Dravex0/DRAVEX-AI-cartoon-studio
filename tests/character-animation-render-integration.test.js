import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterRigMotionPreset } from '../src/character-rig-motion-presets.js';
import { sampleCharacterRigTimeline } from '../src/character-rig-timeline.js';
import { drawCharacterLayers } from '../src/scene-character-layers.js';

function renderRigFrame(rig, pose) {
  const rotations = [];
  const drawnImages = [];
  const context = {
    globalAlpha: 1,
    save() {},
    restore() {},
    translate() {},
    rotate(value) { rotations.push(value); },
    drawImage(image) { drawnImages.push(image); }
  };
  const image = { naturalWidth: 64, naturalHeight: 96 };
  const result = drawCharacterLayers(
    context,
    [],
    () => image,
    640,
    360,
    {
      drawRigParts: true,
      preferRigParts: true,
      characterRigs: [rig],
      rigPoses: pose
    }
  );
  return { result, rotations, drawnImages };
}

test('sampled wave rig poses reach the renderer as visibly different character frames', () => {
  const rig = {
    schemaVersion: 1,
    characterId: 'Foxy',
    bones: [
      { id: 'root', parentId: null, pivotX: 0.5, pivotY: 0.5 },
      { id: 'rightArm', parentId: 'root', pivotX: 0.55, pivotY: 0.35 }
    ],
    parts: [
      {
        id: 'arm',
        boneId: 'rightArm',
        imageUrl: 'https://assets.example/foxy-arm.png',
        x: 0.62,
        y: 0.4,
        width: 0.12,
        height: 0.2,
        rotation: 0,
        zIndex: 1
      }
    ]
  };

  const generated = createCharacterRigMotionPreset(rig, 'wave');
  assert.equal(generated.status, 'ready');
  assert.ok(generated.animatedBoneIds.includes('rightArm'));

  const raisedPose = sampleCharacterRigTimeline(generated.timeline, 0.25);
  const loweredPose = sampleCharacterRigTimeline(generated.timeline, 0.75);
  const raisedFrame = renderRigFrame(rig, raisedPose);
  const loweredFrame = renderRigFrame(rig, loweredPose);

  for (const frame of [raisedFrame, loweredFrame]) {
    assert.equal(frame.result.rigDrawn, 1);
    assert.deepEqual(frame.result.rigReadyCharacterIds, ['Foxy']);
    assert.equal(frame.drawnImages.length, 1);
    assert.ok(frame.drawnImages[0].naturalWidth > 0);
  }
  assert.notEqual(raisedFrame.rotations[0], loweredFrame.rotations[0]);
  assert.ok(Math.abs(raisedFrame.rotations[0] - loweredFrame.rotations[0]) > 0.2);
});

import { test, expect } from '@playwright/test';
import { drawCharacterLayers } from '../../src/scene-character-layers.js';
import { createCharacterRigMotionPreset } from '../../src/character-rig-motion-presets.js';
import { sampleCharacterRigTimeline } from '../../src/character-rig-timeline.js';

function makePart(color) {
  const canvas = document.createElement('canvas');
  canvas.width = 24;
  canvas.height = 48;
  const context = canvas.getContext('2d');
  context.fillStyle = color;
  context.fillRect(2, 2, 20, 44);
  return canvas;
}

function makeRig() {
  const bones = [
    { id: 'root', parentId: null },
    { id: 'leftArm', parentId: 'root' },
    { id: 'rightArm', parentId: 'root' },
    { id: 'leftLeg', parentId: 'root' },
    { id: 'rightLeg', parentId: 'root' },
    { id: 'head', parentId: 'root' }
  ];
  const parts = [
    { id: 'body', boneId: 'root', imageUrl: 'body', x: 0.5, y: 0.52, width: 0.22, height: 0.32, zIndex: 0 },
    { id: 'left-arm', boneId: 'leftArm', imageUrl: 'left-arm', x: 0.36, y: 0.46, width: 0.08, height: 0.25, zIndex: 1 },
    { id: 'right-arm', boneId: 'rightArm', imageUrl: 'right-arm', x: 0.64, y: 0.46, width: 0.08, height: 0.25, zIndex: 2 },
    { id: 'left-leg', boneId: 'leftLeg', imageUrl: 'left-leg', x: 0.44, y: 0.76, width: 0.09, height: 0.25, zIndex: 3 },
    { id: 'right-leg', boneId: 'rightLeg', imageUrl: 'right-leg', x: 0.56, y: 0.76, width: 0.09, height: 0.25, zIndex: 4 },
    { id: 'head', boneId: 'head', imageUrl: 'head', x: 0.5, y: 0.28, width: 0.16, height: 0.16, zIndex: 5 }
  ];
  return { schemaVersion: 1, characterId: 'PixelProof', bones, parts };
}

function renderPose(rig, images, pose) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 320;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = '#18202d';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const result = drawCharacterLayers(context, [], key => images[key], 320, 320, {
    drawRigParts: true,
    characterRigs: [rig],
    rigPoses: pose
  });
  return {
    result,
    pixels: context.getImageData(0, 0, canvas.width, canvas.height).data
  };
}

test('browser canvas renders visible character rig pixels that change between walk-cycle poses', async ({ page }) => {
  await page.setContent('<!doctype html><html><body></body></html>');
  const evidence = await page.evaluate(async () => {
    const { drawCharacterLayers } = await import('/src/scene-character-layers.js');
    const { createCharacterRigMotionPreset } = await import('/src/character-rig-motion-presets.js');
    const { sampleCharacterRigTimeline } = await import('/src/character-rig-timeline.js');

    function makePart(color) {
      const canvas = document.createElement('canvas');
      canvas.width = 24;
      canvas.height = 48;
      const context = canvas.getContext('2d');
      context.fillStyle = color;
      context.fillRect(2, 2, 20, 44);
      return canvas;
    }

    const rig = {
      schemaVersion: 1,
      characterId: 'PixelProof',
      bones: [
        { id: 'root', parentId: null },
        { id: 'leftArm', parentId: 'root' },
        { id: 'rightArm', parentId: 'root' },
        { id: 'leftLeg', parentId: 'root' },
        { id: 'rightLeg', parentId: 'root' },
        { id: 'head', parentId: 'root' }
      ],
      parts: [
        { id: 'body', boneId: 'root', imageUrl: 'body', x: 0.5, y: 0.52, width: 0.22, height: 0.32, zIndex: 0 },
        { id: 'left-arm', boneId: 'leftArm', imageUrl: 'left-arm', x: 0.36, y: 0.46, width: 0.08, height: 0.25, zIndex: 1 },
        { id: 'right-arm', boneId: 'rightArm', imageUrl: 'right-arm', x: 0.64, y: 0.46, width: 0.08, height: 0.25, zIndex: 2 },
        { id: 'left-leg', boneId: 'leftLeg', imageUrl: 'left-leg', x: 0.44, y: 0.76, width: 0.09, height: 0.25, zIndex: 3 },
        { id: 'right-leg', boneId: 'rightLeg', imageUrl: 'right-leg', x: 0.56, y: 0.76, width: 0.09, height: 0.25, zIndex: 4 },
        { id: 'head', boneId: 'head', imageUrl: 'head', x: 0.5, y: 0.28, width: 0.16, height: 0.16, zIndex: 5 }
      ]
    };
    const colors = ['#f3a712', '#e85d75', '#5bc0eb', '#9bc53d', '#c34271', '#f4f1de'];
    const keys = ['body', 'left-arm', 'right-arm', 'left-leg', 'right-leg', 'head'];
    const images = Object.fromEntries(keys.map((key, index) => [key, makePart(colors[index])]));
    const preset = createCharacterRigMotionPreset(rig, 'walk');
    if (preset.status !== 'ready') throw new Error('Walk preset did not produce a validated timeline.');
    const phases = [0.25, 0.75];
    const frames = phases.map(phase => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 320;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.fillStyle = '#18202d';
      context.fillRect(0, 0, 320, 320);
      const poses = sampleCharacterRigTimeline(preset.timeline, phase);
      const draw = drawCharacterLayers(context, [], key => images[key], 320, 320, {
        drawRigParts: true,
        characterRigs: [rig],
        rigPoses: poses
      });
      const pixels = context.getImageData(0, 0, 320, 320).data;
      let characterPixels = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] > 0 && !(pixels[i] === 24 && pixels[i + 1] === 32 && pixels[i + 2] === 45)) characterPixels++;
      }
      return { draw, characterPixels, pixels: Array.from(pixels) };
    });
    let changedPixels = 0;
    for (let i = 0; i < frames[0].pixels.length; i += 4) {
      if (frames[0].pixels[i] !== frames[1].pixels[i]
        || frames[0].pixels[i + 1] !== frames[1].pixels[i + 1]
        || frames[0].pixels[i + 2] !== frames[1].pixels[i + 2]) changedPixels++;
    }
    return {
      presetStatus: preset.status,
      drawnParts: frames.map(frame => frame.draw.rigDrawn),
      skippedParts: frames.map(frame => frame.draw.rigSkipped),
      characterPixels: frames.map(frame => frame.characterPixels),
      changedPixels
    };
  });

  expect(evidence.presetStatus).toBe('ready');
  expect(evidence.drawnParts).toEqual([6, 6]);
  expect(evidence.skippedParts).toEqual([0, 0]);
  expect(evidence.characterPixels.every(count => count > 500)).toBeTruthy();
  expect(evidence.changedPixels).toBeGreaterThan(100);
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterRigMotionPreset, listCharacterRigMotionPresets } from '../src/character-rig-motion-presets.js';
import { sampleCharacterRigTimeline } from '../src/character-rig-timeline.js';

const rig = () => ({
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
});

describe('procedural character rig motion presets', () => {
  it('exposes the supported starter movement library', () => {
    assert.deepEqual(listCharacterRigMotionPresets().map(item => item.id), ['idle', 'walk', 'run', 'jump', 'wave']);
  });

  it('creates a validated walk cycle with explicit start and end frames', () => {
    const result = createCharacterRigMotionPreset(rig(), 'walk');
    assert.equal(result.status, 'ready');
    assert.equal(result.timeline.keyframes[0].time, 0);
    assert.equal(result.timeline.keyframes.at(-1).time, 1);
    assert.equal(result.timeline.keyframes.length, 5);
    assert.ok(result.animatedBoneIds.includes('leftLeg'));
    assert.ok(result.animatedBoneIds.includes('rightArm'));
  });

  it('creates different run and walk amplitudes', () => {
    const walk = createCharacterRigMotionPreset(rig(), 'walk');
    const run = createCharacterRigMotionPreset(rig(), 'run');
    const walkMid = sampleCharacterRigTimeline(walk.timeline, 0.25).Foxy.leftLeg.rotation;
    const runMid = sampleCharacterRigTimeline(run.timeline, 0.25).Foxy.leftLeg.rotation;
    assert.ok(Math.abs(runMid) > Math.abs(walkMid));
  });

  it('creates a jump with vertical root movement and a greeting with arm motion', () => {
    const jump = createCharacterRigMotionPreset(rig(), 'jump');
    const wave = createCharacterRigMotionPreset(rig(), 'wave');
    assert.ok(jump.timeline.keyframes.some(frame => frame.poses.Foxy.root.y < 0));
    assert.ok(wave.timeline.keyframes.some(frame => frame.poses.Foxy.rightArm.rotation !== -0.8));
  });

  it('reports missing limbs instead of claiming they were animated', () => {
    const simpleRig = rig();
    simpleRig.bones = [{ id: 'root', parentId: null }, { id: 'head', parentId: 'root' }];
    simpleRig.parts = [{ id: 'body', boneId: 'root', imageUrl: 'https://assets.example/body.png' }];
    const result = createCharacterRigMotionPreset(simpleRig, 'walk');
    assert.equal(result.status, 'ready');
    assert.equal(result.animatedBoneIds.includes('leftLeg'), false);
    assert.ok(result.warnings.some(message => message.includes('No leg-like')));
    const wave = createCharacterRigMotionPreset(simpleRig, 'wave');
    assert.ok(wave.warnings.some(message => message.includes('No right-arm')));
  });

  it('rejects an invalid rig and an unknown preset', () => {
    assert.equal(createCharacterRigMotionPreset({}, 'walk').status, 'invalid-rig');
    assert.equal(createCharacterRigMotionPreset(rig(), 'dance').status, 'unknown-preset');
  });
});

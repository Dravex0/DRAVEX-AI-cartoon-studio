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

  it('keeps cyclic presets linear while easing jump segments', () => {
    for (const presetName of ['idle', 'walk', 'run', 'wave']) {
      const result = createCharacterRigMotionPreset(rig(), presetName);
      assert.equal(result.status, 'ready');
      assert.ok(result.timeline.keyframes.every(frame => frame.easing === 'linear'), `${presetName} should not pause at each keyframe`);
    }
    const jump = createCharacterRigMotionPreset(rig(), 'jump');
    assert.equal(jump.timeline.keyframes[0].easing, 'linear');
    assert.ok(jump.timeline.keyframes.slice(1).every(frame => frame.easing === 'ease-in-out'));
  });

  it('recognizes left/right hand and foot bone naming conventions', () => {
    const namingSets = [
      { leftArm: 'leftHand', rightArm: 'rightHand', leftLeg: 'leftThigh', rightLeg: 'rightThigh' },
      { leftArm: 'upperArmL', rightArm: 'upperArmR', leftLeg: 'thighL', rightLeg: 'thighR' }
    ];
    for (const names of namingSets) {
      const candidate = rig();
      const replacements = {
        leftArm: names.leftArm, rightArm: names.rightArm,
        leftLeg: names.leftLeg, rightLeg: names.rightLeg
      };
      candidate.bones = candidate.bones.map(bone => ({
        ...bone, id: replacements[bone.id] || bone.id
      }));
      candidate.parts = candidate.parts.map(part => ({
        ...part, boneId: replacements[part.boneId] || part.boneId
      }));
      const result = createCharacterRigMotionPreset(candidate, 'walk');
      assert.equal(result.status, 'ready');
      const pose = sampleCharacterRigTimeline(result.timeline, 0.25).Foxy;
      assert.ok(pose[names.leftArm].rotation > 0, names.leftArm);
      assert.ok(pose[names.rightArm].rotation < 0, names.rightArm);
      assert.ok(pose[names.leftLeg].rotation < 0, names.leftLeg);
      assert.ok(pose[names.rightLeg].rotation > 0, names.rightLeg);
    }
  });

  it('recognizes foot and ankle bones and compensates for root bounce', () => {
    const namingSets = [
      ['leftFoot', 'rightFoot'],
      ['ankle_l', 'rightAnkle'],
      ['footL', 'footR']
    ];
    for (const [leftFoot, rightFoot] of namingSets) {
      const candidate = rig();
      candidate.bones.push(
        { id: leftFoot, parentId: 'leftLeg' },
        { id: rightFoot, parentId: 'rightLeg' }
      );
      candidate.parts.push(
        { id: 'foot-left-part', boneId: leftFoot, imageUrl: 'https://assets.example/foot-left.png' },
        { id: 'foot-right-part', boneId: rightFoot, imageUrl: 'https://assets.example/foot-right.png' }
      );
      const result = createCharacterRigMotionPreset(candidate, 'walk');
      assert.equal(result.status, 'ready');
      const pose = sampleCharacterRigTimeline(result.timeline, 0.25).Foxy;
      assert.equal(pose.root.y, 0.018);
      assert.equal(pose[leftFoot].y, -0.018);
      assert.equal(pose[rightFoot].y, -0.018);
      assert.equal(result.warnings.some(message => message.includes('root bounce cannot be compensated')), false);
    }
  });

  it('animates lower-leg bones as knee bends only when knee pivots are defined', () => {
    const candidate = rig();
    candidate.bones.push(
      { id: 'lowerLegL', parentId: 'leftLeg', pivotX: 0.42, pivotY: 0.61 },
      { id: 'shin_r', parentId: 'rightLeg', pivotX: 0.58, pivotY: 0.61 }
    );
    candidate.parts.push(
      { id: 'shin-left-part', boneId: 'lowerLegL', imageUrl: 'https://assets.example/shin-left.png' },
      { id: 'shin-right-part', boneId: 'shin_r', imageUrl: 'https://assets.example/shin-right.png' }
    );

    const walk = createCharacterRigMotionPreset(candidate, 'walk');
    assert.equal(walk.status, 'ready');
    const walkPose = sampleCharacterRigTimeline(walk.timeline, 0.25).Foxy;
    assert.ok(walkPose.lowerLegL.rotation > 0);
    assert.equal(walkPose.shin_r, undefined);
    const rightSwingPose = sampleCharacterRigTimeline(walk.timeline, 0.75).Foxy;
    assert.ok(rightSwingPose.shin_r.rotation > 0);
    assert.ok(!walk.warnings.some(message => message.includes('knee pivots are defined')));

    const run = createCharacterRigMotionPreset(candidate, 'run');
    const runPose = sampleCharacterRigTimeline(run.timeline, 0.25).Foxy;
    assert.ok(runPose.lowerLegL.rotation > walkPose.lowerLegL.rotation);

    const legacy = rig();
    legacy.bones.push({ id: 'leftShin', parentId: 'leftLeg' });
    legacy.parts.push({ id: 'shin-part', boneId: 'leftShin', imageUrl: 'https://assets.example/shin.png' });
    const legacyWalk = createCharacterRigMotionPreset(legacy, 'walk');
    assert.equal(legacyWalk.status, 'ready');
    const legacyPose = sampleCharacterRigTimeline(legacyWalk.timeline, 0.25).Foxy;
    assert.equal(legacyPose.leftShin, undefined);
    assert.ok(legacyWalk.warnings.some(message => message.includes('knee pivots are defined')));
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
    assert.ok(jump.timeline.keyframes.some(frame => frame.poses.Foxy?.root?.y < 0));
    assert.ok(wave.timeline.keyframes.some(frame => frame.poses.Foxy?.rightArm?.rotation !== undefined && frame.poses.Foxy.rightArm.rotation !== -0.8));
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
  it('warns when only one lower-leg bone has a knee pivot', () => {
    const candidate = rig();
    candidate.bones.push(
      { id: 'leftShin', parentId: 'leftLeg', pivotX: 0.42, pivotY: 0.61 },
      { id: 'rightShin', parentId: 'rightLeg' }
    );
    candidate.parts.push(
      { id: 'left-shin-part', boneId: 'leftShin', imageUrl: 'https://assets.example/left-shin.png' },
      { id: 'right-shin-part', boneId: 'rightShin', imageUrl: 'https://assets.example/right-shin.png' }
    );
    for (const presetName of ['walk', 'run', 'jump']) {
      const result = createCharacterRigMotionPreset(candidate, presetName);
      assert.equal(result.status, 'ready');
      assert.ok(result.warnings.some(message => message.includes('lower-leg bones have no knee pivots defined')), presetName);
      const pose = sampleCharacterRigTimeline(result.timeline, 0.25).Foxy;
      assert.equal(pose.leftShin?.rotation !== undefined, true, presetName);
      assert.equal(pose.rightShin, undefined, presetName);
    }
  });

  it('warns about missing knee pivots during jump as well as walk and run', () => {
    const candidate = rig();
    candidate.bones.push({ id: 'leftCalf', parentId: 'leftLeg' });
    candidate.parts.push({ id: 'calf-part', boneId: 'leftCalf', imageUrl: 'https://assets.example/calf.png' });
    const result = createCharacterRigMotionPreset(candidate, 'jump');
    assert.equal(result.status, 'ready');
    assert.ok(result.warnings.some(message => message.includes('knee pivots are defined')));
    assert.equal(sampleCharacterRigTimeline(result.timeline, 0.25).Foxy.leftCalf, undefined);
  });

});

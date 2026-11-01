import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterRigMotionPreset, listCharacterRigMotionPresets } from '../src/character-rig-motion-presets.js';
import { sampleCharacterRigTimeline } from '../src/character-rig-timeline.js';
import { applyCharacterRigPose } from '../src/character-rig.js';

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
    assert.equal(result.timeline.keyframes.length, 9);
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

  it('animates lower-leg bones as knee bends only when lower-leg bones have no knee pivots defined', () => {
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
    assert.ok(!walk.warnings.some(message => message.includes('lower-leg bones have no knee pivots defined')));

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
    assert.ok(legacyWalk.warnings.some(message => message.includes('lower-leg bones have no knee pivots defined')));
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
    assert.ok(result.warnings.some(message => message.includes('lower-leg bones have no knee pivots defined')));
    assert.equal(sampleCharacterRigTimeline(result.timeline, 0.25).Foxy.leftCalf, undefined);
  });

});


const close = (actual, expected, tolerance = 1e-4) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${actual} to be close to ${expected}`);
};

function rigWithPlantedLegs() {
  const candidate = rig();
  candidate.bones.push(
    { id: 'leftLowerLeg', parentId: 'leftLeg', pivotX: 0.38, pivotY: 0.58 },
    { id: 'leftFoot', parentId: 'leftLowerLeg', pivotX: 0.42, pivotY: 0.78 },
    { id: 'rightLowerLeg', parentId: 'rightLeg', pivotX: 0.62, pivotY: 0.58 },
    { id: 'rightFoot', parentId: 'rightLowerLeg', pivotX: 0.58, pivotY: 0.78 }
  );
  candidate.bones = candidate.bones.map(bone => {
    if (bone.id === 'leftLeg') return { ...bone, pivotX: 0.42, pivotY: 0.35 };
    if (bone.id === 'rightLeg') return { ...bone, pivotX: 0.58, pivotY: 0.35 };
    return bone;
  });
  candidate.parts.push(
    { id: 'left-ankle-marker', boneId: 'leftFoot', imageUrl: 'https://assets.example/left-ankle.png', x: 0.42, y: 0.78 },
    { id: 'right-ankle-marker', boneId: 'rightFoot', imageUrl: 'https://assets.example/right-ankle.png', x: 0.58, y: 0.78 }
  );
  return candidate;
}

describe('foot-planted walk and run IK integration', () => {
  it('keeps each stance ankle fixed while the opposite foot swings and the root advances', () => {
    const candidate = rigWithPlantedLegs();
    const walk = createCharacterRigMotionPreset(candidate, 'walk');
    assert.equal(walk.status, 'ready');
    assert.equal(walk.timeline.keyframes.length, 9);
    assert.equal(walk.warnings.some(message => message.includes('Foot-planting IK is disabled')), false);

    const poseAt = progress => sampleCharacterRigTimeline(walk.timeline, progress).Foxy;
    const partsAt = progress => applyCharacterRigPose(candidate.parts, candidate, poseAt(progress));
    const start = partsAt(0);
    const leftStance = partsAt(0.25);
    const middle = partsAt(0.5);
    const rightStance = partsAt(0.75);
    const end = partsAt(1);
    const part = (items, id) => items.find(item => item.id === id);

    close(part(start, 'left-ankle-marker').x, 0.42);
    close(part(leftStance, 'left-ankle-marker').x, 0.42);
    close(part(start, 'left-ankle-marker').y, 0.78);
    close(part(leftStance, 'left-ankle-marker').y, 0.78);

    close(part(middle, 'right-ankle-marker').x, 0.58);
    close(part(rightStance, 'right-ankle-marker').x, 0.58);
    close(part(middle, 'right-ankle-marker').y, 0.78);
    close(part(rightStance, 'right-ankle-marker').y, 0.78);

    assert.ok(part(leftStance, 'right-ankle-marker').y < 0.78, 'right foot should be lifted during swing');
    assert.ok(part(rightStance, 'left-ankle-marker').y < 0.78, 'left foot should be lifted during swing');
    assert.ok(poseAt(1).root.x > poseAt(0).root.x, 'root should advance across the gait');
    close(part(end, 'left-ankle-marker').x, 0.42 + poseAt(1).root.x);
    close(part(end, 'right-ankle-marker').x, 0.58);
  });

  it('keeps both ankle paths on their requested reachable targets at every keyframe', () => {
    const candidate = rigWithPlantedLegs();
    const walk = createCharacterRigMotionPreset(candidate, 'walk');
    const stride = walk.timeline.keyframes.at(-1).poses.Foxy.root.x;
    const upperLength = Math.hypot(0.04, 0.23);
    const lowerLength = Math.hypot(0.04, 0.20);
    const liftHeight = Math.max(0.02, Math.min(0.075, (upperLength + lowerLength) * 0.14));
    const smooth = value => value * value * (3 - 2 * value);

    for (const frame of walk.timeline.keyframes) {
      const phase = frame.time;
      const progressLeft = Math.max(0, Math.min(1, (phase - 0.5) * 2));
      const progressRight = Math.max(0, Math.min(1, phase * 2));
      const leftSwing = phase > 0.5;
      const rightSwing = phase < 0.5;
      const expectedLeftX = leftSwing ? 0.42 + stride * smooth(progressLeft) : 0.42;
      const expectedRightX = rightSwing ? 0.58 - stride * (1 - smooth(progressRight)) : 0.58;
      const expectedLeftY = 0.78 - (leftSwing ? Math.sin(Math.PI * progressLeft) * liftHeight : 0);
      const expectedRightY = 0.78 - (rightSwing ? Math.sin(Math.PI * progressRight) * liftHeight : 0);
      const posed = applyCharacterRigPose(candidate.parts, candidate, frame.poses.Foxy);
      const left = posed.find(part => part.id === 'left-ankle-marker');
      const right = posed.find(part => part.id === 'right-ankle-marker');
      close(left.x, expectedLeftX, 2e-4);
      close(left.y, expectedLeftY, 2e-4);
      close(right.x, expectedRightX, 2e-4);
      close(right.y, expectedRightY, 2e-4);
    }
  });

  it('falls back atomically when either leg cannot reach its swing target', () => {
    const candidate = rigWithPlantedLegs();
    candidate.bones = candidate.bones.map(bone => {
      if (bone.id === 'leftLeg') return { ...bone, pivotX: 0.42, pivotY: 0.4 };
      if (bone.id === 'leftLowerLeg') return { ...bone, pivotX: 0.42, pivotY: 0.6 };
      if (bone.id === 'leftFoot') return { ...bone, pivotX: 0.42, pivotY: 0.5 };
      if (bone.id === 'rightLeg') return { ...bone, pivotX: 0.58, pivotY: 0.4 };
      if (bone.id === 'rightLowerLeg') return { ...bone, pivotX: 0.58, pivotY: 0.6 };
      if (bone.id === 'rightFoot') return { ...bone, pivotX: 0.58, pivotY: 0.5 };
      return bone;
    });
    candidate.parts = candidate.parts.map(part => (
      part.id === 'left-ankle-marker' || part.id === 'right-ankle-marker'
        ? { ...part, y: 0.5 } : part
    ));
    const result = createCharacterRigMotionPreset(candidate, 'walk');
    assert.equal(result.status, 'ready');
    assert.ok(result.warnings.some(message => message.includes('could not reach one or more requested ankle targets')));
    const frame = result.timeline.keyframes.find(item => item.time === 0.125);
    assert.ok(frame);
    assert.equal(frame.poses.Foxy.root?.x, 0, 'root translation must not be committed on a failed IK frame');
    close(frame.poses.Foxy.leftLeg.rotation, -Math.sin(Math.PI / 4) * 0.38);
    close(frame.poses.Foxy.rightLeg.rotation, Math.sin(Math.PI / 4) * 0.38);
  });

  it('uses a longer stride for running than walking', () => {
    const candidate = rigWithPlantedLegs();
    const walk = createCharacterRigMotionPreset(candidate, 'walk');
    const run = createCharacterRigMotionPreset(candidate, 'run');
    assert.ok(run.timeline.keyframes.at(-1).poses.Foxy.root.x > walk.timeline.keyframes.at(-1).poses.Foxy.root.x);
  });

  it('keeps legacy presets and reports why IK is disabled for incomplete leg chains', () => {
    const candidate = rigWithPlantedLegs();
    candidate.bones = candidate.bones.filter(bone => bone.id !== 'rightFoot');
    candidate.parts = candidate.parts.filter(part => part.id !== 'right-ankle-marker');
    const result = createCharacterRigMotionPreset(candidate, 'walk');
    assert.equal(result.status, 'ready');
    assert.ok(result.warnings.some(message => message.includes('Foot-planting IK is disabled')));
    assert.equal(result.timeline.keyframes.length, 9);
  });
});

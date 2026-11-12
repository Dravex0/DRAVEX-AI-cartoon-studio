import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterRigTimelineFromActionTimeline } from '../src/character-rig-action-planner.js';
import { sampleCharacterRigTimeline } from '../src/character-rig-timeline.js';
import { applyCharacterRigPose } from '../src/character-rig.js';

const rig = (characterId = 'Foxy') => ({
  schemaVersion: 1,
  characterId,
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
const makeScene = description => ({
  characters: ['Foxy'],
  characterCastProvided: true,
  storyDetail: 'Foxy ' + description,
  actionTimeline: {
    schemaVersion: 1,
    phases: [{
      phase: 'action', start: 0.2, end: 0.8, actorId: 'Foxy',
      targetId: null, description: 'Foxy ' + description,
      evidence: 'Foxy ' + description
    }]
  }
});

test('maps grounded dodge action into an articulated rig timeline in scene time', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('dodges the incoming strike'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.generatedCount, 1);
  assert.equal(result.mappedActions[0].preset, 'dodge');
  const middle = sampleCharacterRigTimeline(result.timeline, 0.5).Foxy;
  assert.ok(Math.abs(middle.leftArm.rotation) > 0.5);
  assert.ok(Math.abs(middle.rightArm.rotation) > 0.5);
  assert.equal(result.timeline.keyframes[0].time, 0);
  assert.equal(result.timeline.keyframes.at(-1).time, 1);
});

test('maps jump action and preserves neutral poses outside its scene-time interval', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('jumps over the stone'), [rig()]);
  assert.equal(result.status, 'generated');
  const before = sampleCharacterRigTimeline(result.timeline, 0.1).Foxy || {};
  const middle = sampleCharacterRigTimeline(result.timeline, 0.35).Foxy;
  assert.equal(before.root?.y || 0, 0);
  assert.ok(Math.abs(middle.root.y) > 0);
});

test('does not guess a rig preset for unsupported semantic actions', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('opens a mysterious chest'), [rig()]);
  assert.equal(result.status, 'no-supported-actions');
  assert.equal(result.timeline, null);
  assert.equal(result.skipped[0].reason, 'unsupported-or-ambiguous-action');
});

test('blocks invalid action timelines before generating rig poses', () => {
  const scene = makeScene('dodges the incoming strike');
  scene.actionTimeline.phases[0].evidence = 'invented evidence';
  const result = createCharacterRigTimelineFromActionTimeline(scene, [rig()]);
  assert.equal(result.status, 'blocked');
  assert.equal(result.timeline, null);
});


test('combines grounded actions for multiple characters on one scene clock', () => {
  const scene = {
    characters: ['Foxy', 'Bunny'],
    characterCastProvided: true,
    storyDetail: 'Foxy walks to the gate. Bunny jumps over the stone. Foxy runs away. Bunny walks to Foxy.',
    actionTimeline: {
      schemaVersion: 1,
      phases: [
        { phase: 'preparation', start: 0.05, end: 0.2, actorId: 'Foxy', targetId: null, description: 'Foxy walks to the gate', evidence: 'Foxy walks to the gate.' },
        { phase: 'action', start: 0.25, end: 0.5, actorId: 'Bunny', targetId: null, description: 'Bunny jumps over the stone', evidence: 'Bunny jumps over the stone.' },
        { phase: 'reaction', start: 0.55, end: 0.7, actorId: 'Foxy', targetId: null, description: 'Foxy runs away', evidence: 'Foxy runs away.' },
        { phase: 'result', start: 0.75, end: 0.9, actorId: 'Bunny', targetId: null, description: 'Bunny walks to Foxy', evidence: 'Bunny walks to Foxy.' }
      ]
    }
  };
  const result = createCharacterRigTimelineFromActionTimeline(scene, [rig('Foxy'), rig('Bunny')]);
  assert.equal(result.status, 'generated');
  assert.equal(result.generatedCount, 4);
  assert.deepEqual(result.mappedActions.map(item => item.actorId).sort(), ['Bunny', 'Bunny', 'Foxy', 'Foxy']);
  assert.ok(sampleCharacterRigTimeline(result.timeline, 0.35).Bunny);
  assert.ok(sampleCharacterRigTimeline(result.timeline, 0.6).Foxy);
});

test('reports supported story actions whose actor has no attached rig', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('jumps over the stone'), [rig('Bunny')]);
  assert.equal(result.status, 'no-supported-actions');
  assert.equal(result.timeline, null);
  assert.equal(result.skipped[0].reason, 'actor-rig-missing');
});


test('maps an explicit English greeting wave to the articulated wave preset', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('waves hello to the traveler'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].preset, 'wave');
  const middle = sampleCharacterRigTimeline(result.timeline, 0.5).Foxy;
  assert.ok(Math.abs(middle.rightArm.rotation) > 0.5);
});

test('maps an explicit Russian hand wave to the articulated wave preset', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('машет рукой путнику'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].preset, 'wave');
  const middle = sampleCharacterRigTimeline(result.timeline, 0.5).Foxy;
  assert.ok(Math.abs(middle.rightArm.rotation) > 0.5);
});

test('maps an explicit Spanish hand wave to the articulated wave preset', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('saluda con la mano al viajero'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].preset, 'wave');
  const middle = sampleCharacterRigTimeline(result.timeline, 0.5).Foxy;
  assert.ok(Math.abs(middle.rightArm.rotation) > 0.5);
});

test('maps grounded attack actions to a visible articulated strike', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('attacks the stone golem'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].preset, 'attack');
  const middle = sampleCharacterRigTimeline(result.timeline, 0.5).Foxy;
  assert.ok(middle.root.x > 0);
  assert.ok(Math.abs(middle.rightArm.rotation) > 0.8);
});

test('maps grounded defense actions to an articulated protective brace', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('raises a shield and protects the village'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].preset, 'defend');
  const middle = sampleCharacterRigTimeline(result.timeline, 0.5).Foxy;
  assert.ok(middle.root.y > 0);
  assert.ok(Math.abs(middle.leftArm.rotation) > 0.4);
  assert.ok(Math.abs(middle.rightArm.rotation) > 0.4);
});

test('maps grounded English dance action to a looping articulated full-body groove', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('dances to the music'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].preset, 'dance');
  const start = sampleCharacterRigTimeline(result.timeline, 0.2).Foxy || {};
  const middle = sampleCharacterRigTimeline(result.timeline, 0.5).Foxy;
  const end = sampleCharacterRigTimeline(result.timeline, 0.8).Foxy || {};
  assert.ok(Math.abs(middle.leftArm.rotation) > 0.2);
  assert.ok(Math.abs(middle.rightArm.rotation) > 0.2);
  assert.equal(start.root?.y || 0, end.root?.y || 0);
});

test('maps grounded Ukrainian dance action to the dance preset', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('танцює під музику'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].preset, 'dance');
});

test('maps grounded dialogue phases through the Doodle adapter to idle body motion', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('whispers a warning to the traveler'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.generatedCount, 1);
  assert.equal(result.mappedActions[0].doodleAction, 'talk');
  assert.equal(result.mappedActions[0].preset, 'idle');
  assert.ok(sampleCharacterRigTimeline(result.timeline, 0.35).Foxy);
});

test('maps explicit fear reactions through the Doodle adapter to the existing defend rig preset', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('is scared by the sudden thunder'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].doodleAction, 'scared');
  assert.equal(result.mappedActions[0].preset, 'defend');
  const middle = sampleCharacterRigTimeline(result.timeline, 0.5).Foxy;
  assert.ok(Math.abs(middle.leftArm.rotation) > 0.4);
  assert.ok(Math.abs(middle.rightArm.rotation) > 0.4);
});


test('solves a grounded pickup phase to the explicit prop anchor and keeps the hand there while holding', () => {
  const target = { x: 0.78, y: 0.35 };
  const candidate = {
    schemaVersion: 1,
    characterId: 'Foxy',
    bones: [
      { id: 'root', parentId: null, pivotX: 0.5, pivotY: 0.78, pivotEnabled: true },
      { id: 'torso', parentId: 'root', pivotX: 0.5, pivotY: 0.43, pivotEnabled: true },
      { id: 'rightArm', parentId: 'torso', pivotX: 0.63, pivotY: 0.39, pivotEnabled: true },
      { id: 'rightLowerArm', parentId: 'rightArm', pivotX: 0.69, pivotY: 0.47, pivotEnabled: true }
    ],
    parts: [
      { id: 'torso-part', boneId: 'torso', imageUrl: 'https://assets.example/torso.png', x: 0.5, y: 0.52, width: 0.3, height: 0.34 },
      { id: 'upper-arm-part', boneId: 'rightArm', imageUrl: 'https://assets.example/upper-arm.png', x: 0.65, y: 0.4, width: 0.15, height: 0.23 },
      { id: 'rightHand', boneId: 'rightLowerArm', imageUrl: 'https://assets.example/hand.png', x: 0.71, y: 0.55, width: 0.14, height: 0.22, gripOffsetX: 0.07, gripOffsetY: 0 }
    ]
  };
  const scene = {
    characters: ['Foxy'],
    characterCastProvided: true,
    storyDetail: 'Foxy picks up the glowing star.',
    propAnchors: { 'glowing star': target },
    stateChanges: [{
      entityType: 'prop', entityId: 'glowing star', property: 'holder',
      previousValue: null, value: 'Foxy', actorId: 'Foxy',
      evidence: 'Foxy picks up the glowing star.'
    }],
    actionTimeline: {
      schemaVersion: 1,
      phases: [{
        phase: 'action', start: 0.2, end: 0.8, actorId: 'Foxy',
        targetId: 'glowing star', description: 'Foxy picks up the glowing star.',
        evidence: 'Foxy picks up the glowing star.'
      }]
    }
  };
  const result = createCharacterRigTimelineFromActionTimeline(scene, [candidate]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].contactTargetId, 'glowing star');
  assert.equal(result.mappedActions[0].contactTargetResolved, true);
  assert.equal(result.mappedActions[0].holdAfterAction, true);

  const pose = sampleCharacterRigTimeline(result.timeline, 0.9).Foxy;
  const hand = applyCharacterRigPose(candidate.parts, candidate, pose).find(part => part.id === 'rightHand');
  const grip = {
    x: hand.x + Math.cos(hand.rotation) * hand.gripOffsetX - Math.sin(hand.rotation) * hand.gripOffsetY,
    y: hand.y + Math.sin(hand.rotation) * hand.gripOffsetX + Math.cos(hand.rotation) * hand.gripOffsetY
  };
  assert.ok(Math.abs(grip.x - target.x) < 0.001);
  assert.ok(Math.abs(grip.y - target.y) < 0.001);
});

test('does not infer a hand contact point when a prop has no explicit scene anchor', () => {
  const scene = makeScene('picks up the glowing star');
  scene.actionTimeline.phases[0].targetId = 'glowing star';
  scene.stateChanges = [{
    entityType: 'prop', entityId: 'glowing star', property: 'holder',
    previousValue: null, value: 'Foxy', actorId: 'Foxy'
  }];
  const result = createCharacterRigTimelineFromActionTimeline(scene, [rig()]);
  assert.equal(result.status, 'generated');
  assert.ok(result.skipped.some(item => item.reason === 'explicit-prop-anchor-missing'));
  assert.equal(result.mappedActions[0].contactTargetResolved, undefined);
});


test('does not solve contact against an anchor for a prop absent from locked state changes', () => {
  const scene = makeScene('picks up the glowing star');
  scene.actionTimeline.phases[0].targetId = 'glowing star';
  scene.propAnchors = { 'glowing star': { x: 0.78, y: 0.35 } };
  const result = createCharacterRigTimelineFromActionTimeline(scene, [rig()]);
  assert.equal(result.status, 'generated');
  assert.ok(result.skipped.some(item => item.reason === 'explicit-prop-target-not-locked'));
  assert.equal(result.mappedActions[0].contactTargetResolved, undefined);
});

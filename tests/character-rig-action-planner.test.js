import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterRigTimelineFromActionTimeline } from '../src/character-rig-action-planner.js';
import { sampleCharacterRigTimeline } from '../src/character-rig-timeline.js';

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

test('maps a grounded opponent recoil to a distinct stagger rig motion', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('recoils and stumbles backward from the strike'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].preset, 'stagger');
  const middle = sampleCharacterRigTimeline(result.timeline, 0.5).Foxy;
  assert.ok(middle.root.x < 0, 'the torso should shift backward during the recoil');
  assert.ok(Math.abs(middle.leftArm.rotation) > 0.3);
  assert.ok(Math.abs(middle.rightArm.rotation) > 0.3);
  const end = sampleCharacterRigTimeline(result.timeline, 0.8).Foxy || {};
  assert.ok(Math.abs(end.root?.x || 0) < 1e-9, 'the rig should return to neutral after the reaction interval');
});

test('maps jump action and preserves neutral poses outside its scene-time interval', () =>
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

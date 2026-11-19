import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterRigTimelineFromActionTimeline } from '../src/character-rig-action-planner.js';

function makeRig(characterId = 'Foxy') {
  return {
    schemaVersion: 1,
    characterId,
    bones: [
      { id: 'root', parentId: null },
      { id: 'leftArm', parentId: 'root', pivotX: 0.5, pivotY: 0.4 },
      { id: 'leftForearm', parentId: 'leftArm', pivotX: 0.65, pivotY: 0.4 },
      { id: 'leftHand', parentId: 'leftForearm', pivotX: 0.8, pivotY: 0.4 }
    ],
    parts: [
      { id: 'body', boneId: 'root', imageUrl: 'https://assets.example/body.png', x: 0.5, y: 0.5 },
      { id: 'hand', boneId: 'leftHand', imageUrl: 'https://assets.example/hand.png', x: 0.8, y: 0.4 }
    ]
  };
}

function makeScene(intent = 'pick_up', physicsEvent = {}) {
  const evidence = 'Foxy picks up the silver key.';
  return {
    id: 'key-interaction',
    characters: ['Foxy'],
    characterCastProvided: true,
    storyDetail: evidence,
    actionTimeline: {
      schemaVersion: 1,
      phases: [{
        phase: 'action', start: 0.2, end: 0.8,
        actorId: 'Foxy', targetId: null,
        description: evidence, evidence,
        steps: [{
          intent, motionCue: 'turn', start: 0.2, end: 0.8,
          actorId: 'Foxy', targetId: 'silver-key',
          description: evidence, evidence
        }]
      }]
    },
    physicsEvents: [{
      id: 'key-contact', type: 'grasp', entityId: 'silver-key',
      actorId: 'Foxy', evidence,
      visualStartPosition: { x: 0.72, y: 0.55 },
      visualEndPosition: { x: 0.72, y: 0.55 },
      visualStartProgress: 0.2, visualEndProgress: 0.8,
      ...physicsEvent
    }]
  };
}

test('uses a grounded physics contact point to solve a character reach when no state-change position exists', () => {
  const scene = makeScene();
  const result = createCharacterRigTimelineFromActionTimeline(scene, [makeRig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].targetedReach, 'solved');
  assert.equal(result.mappedActions[0].targetPositionSource, 'grounded-physics-event');
});

test('does not use physics trajectories when event evidence is not grounded in the story', () => {
  const scene = makeScene('pick_up', { evidence: 'An unrelated sentence.' });
  const result = createCharacterRigTimelineFromActionTimeline(scene, [makeRig()]);
  assert.equal(result.status, 'generated');
  assert.equal(Object.hasOwn(result.mappedActions[0], 'targetedReach'), false);
});

test('does not use another actor or another prop as the interaction target', () => {
  const wrongActor = makeScene('pick_up', { actorId: 'Bunny' });
  const wrongProp = makeScene('pick_up', { entityId: 'different-prop' });
  for (const scene of [wrongActor, wrongProp]) {
    const result = createCharacterRigTimelineFromActionTimeline(scene, [makeRig()]);
    assert.equal(result.status, 'generated');
    assert.equal(Object.hasOwn(result.mappedActions[0], 'targetedReach'), false);
  }
});

test('does not reinterpret 3D meter coordinates as a viewport reach target', () => {
  const scene = makeScene('pick_up', {
    visualStartPosition: null,
    visualEndPosition: null,
    startPosition: { x: 0.72, y: 0.55, z: 0 },
    endPosition: { x: 0.8, y: 0.6, z: 0 }
  });
  const result = createCharacterRigTimelineFromActionTimeline(scene, [makeRig()]);
  assert.equal(result.status, 'generated');
  assert.equal(Object.hasOwn(result.mappedActions[0], 'targetedReach'), false);
});

test('rejects ambiguous grounded physics contacts instead of choosing one arbitrarily', () => {
  const scene = makeScene();
  scene.physicsEvents.push({
    ...scene.physicsEvents[0],
    id: 'second-key-contact',
    visualStartPosition: { x: 0.3, y: 0.4 }
  });
  const result = createCharacterRigTimelineFromActionTimeline(scene, [makeRig()]);
  assert.equal(result.status, 'generated');
  assert.equal(Object.hasOwn(result.mappedActions[0], 'targetedReach'), false);
});

test('uses the end of a grounded incoming trajectory as the target for a catch', () => {
  const scene = makeScene('catch', {
    type: 'catch',
    visualStartPosition: { x: 0.2, y: 0.3 },
    visualEndPosition: { x: 0.72, y: 0.55 }
  });
  const result = createCharacterRigTimelineFromActionTimeline(scene, [makeRig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].targetedReach, 'solved');
  assert.equal(result.mappedActions[0].targetPositionSource, 'grounded-physics-event');
});

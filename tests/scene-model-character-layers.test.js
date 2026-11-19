import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScene } from '../src/scene-model.js';
import { buildScenePhysicsModel } from '../src/scene-physics-model.js';

test('scene normalization preserves validated independent character layers', () => {
  const scene = normalizeScene({
    title: 'Two characters',
    characters: ['Foxy', 'Bird'],
    characterLayers: [
      { characterId: 'Foxy', imageUrl: 'blob:foxy', x: 0.3, y: 0.6, zIndex: 1 },
      { characterId: 'Bird', imageUrl: 'blob:bird', x: 0.7, y: 0.4, zIndex: 2 }
    ]
  });
  assert.deepEqual(scene.characters, ['Foxy', 'Bird']);
  assert.equal(scene.characterLayers.length, 2);
  assert.equal(scene.characterLayers[0].characterId, 'Foxy');
  assert.equal(scene.characterLayers[1].characterId, 'Bird');
});

test('legacy scenes without character layers normalize to an empty layer list', () => {
  assert.deepEqual(normalizeScene({ characters: ['Foxy'] }).characterLayers, []);
});

test('scene normalization rejects duplicate or incomplete character layer records', () => {
  const scene = normalizeScene({
    characterLayers: [
      { characterId: 'Foxy', imageUrl: 'blob:one' },
      { characterId: 'foxy', imageUrl: 'blob:duplicate' },
      { characterId: 'Bird' }
    ]
  });
  assert.equal(scene.characterLayers.length, 1);
  assert.equal(scene.characterLayers[0].imageUrl, 'blob:one');
});


test('scene normalization preserves editor-authored character motion keyframes', () => {
  const scene = normalizeScene({
    characterLayers: [{ characterId: 'Foxy', imageUrl: 'https://example.com/fox.png' }],
    characterMotionTimeline: {
      schemaVersion: 1,
      phases: [{
        phase: 'action', actorId: 'Foxy', start: 0.2, end: 0.8,
        motion: { from: { x: 0.2, y: 0.7 }, to: { x: 0.8, y: 0.3, scale: 1.5 } }
      }]
    }
  });
  assert.equal(scene.characterMotionTimeline.schemaVersion, 1);
  assert.equal(scene.characterMotionTimeline.phases[0].actorId, 'Foxy');
  assert.deepEqual(scene.characterMotionTimeline.phases[0].motion.to, { x: 0.8, y: 0.3, scale: 1.5 });
});

test('legacy scenes without editor-authored motion remain unchanged', () => {
  const scene = normalizeScene({ title: 'Legacy scene' });
  assert.equal(scene.characterMotionTimeline, null);
});

test('scene normalization preserves rig definitions and bounded pose metadata', () => {
  const scene = normalizeScene({
    characterRigs: [{
      schemaVersion: 1,
      characterId: 'Foxy',
      bones: [{ id: 'root', parentId: null }],
      parts: [{
        id: 'body', boneId: 'root', imageUrl: 'https://cdn.example.test/body.png',
        x: 0.5, y: 0.5, width: 0.3, height: 0.5
      }]
    }],
    characterRigPoses: { Foxy: { root: { x: 0.1, y: -0.1, rotation: 0.2 } } }
  });
  assert.equal(scene.characterRigs.length, 1);
  assert.equal(scene.characterRigs[0].characterId, 'Foxy');
  assert.deepEqual(scene.characterRigPoses, { Foxy: { root: { x: 0.1, y: -0.1, rotation: 0.2 } } });
});

test('scene normalization preserves the explicit character rig animation timeline', () => {
  const scene = normalizeScene({
    characterRigTimeline: {
      schemaVersion: 1,
      keyframes: [
        { time: 0, poses: { Foxy: { arm: { rotation: 0 } } } },
        { time: 1, easing: 'ease-in-out', poses: { Foxy: { arm: { rotation: 1 } } } }
      ]
    }
  });
  assert.equal(scene.characterRigTimeline.schemaVersion, 1);
  assert.equal(scene.characterRigTimeline.keyframes.length, 2);
  assert.equal(scene.characterRigTimeline.keyframes[1].easing, 'ease-in-out');
});


test('scene normalization preserves structured causal and physics metadata', () => {
  const scene = normalizeScene({
    id: 'interaction',
    storyDetail: 'Mira pushes the cart.',
    physics: { gravityMps2: 9.81, gravitySource: 'explicit scene setting' },
    physicsEvents: [{
      id: 'cart-motion', type: 'motion', entityId: 'cart',
      startPosition: { x: 0, y: 0, z: 0 }, endPosition: { x: 2, y: 0, z: 0 },
      durationSeconds: 1, evidence: 'Mira pushes the cart.'
    }],
    causalEvents: [{
      id: 'push', type: 'action', actorId: 'Mira', entityId: 'cart',
      evidence: 'Mira pushes the cart.', physicsEventId: 'cart-motion'
    }]
  });

  assert.equal(scene.physics.gravityMps2, 9.81);
  assert.equal(scene.physics.gravitySource, 'explicit scene setting');
  assert.equal(scene.physicsEvents[0].id, 'cart-motion');
  assert.deepEqual(scene.physicsEvents[0].endPosition, { x: 2, y: 0, z: 0 });
  assert.equal(scene.causalEvents[0].actorId, 'Mira');
  assert.equal(scene.causalEvents[0].physicsEventId, 'cart-motion');
});

test('legacy scenes normalize structured causal and physics metadata to safe empty defaults', () => {
  const scene = normalizeScene({ title: 'Legacy scene' });
  assert.equal(scene.physics, null);
  assert.deepEqual(scene.physicsEvents, []);
  assert.deepEqual(scene.causalEvents, []);
});


test('scene normalization preserves timed audio cues for the production planner', () => {
  const scene = normalizeScene({
    id: 'audio-scene',
    audioCues: [
      { type: 'foley', startSeconds: 0.5, endSeconds: 1.25, description: 'Footsteps', characterId: 'Mira' },
      { type: 'music', startSeconds: -2, endSeconds: 'invalid', source: 'Theme' }
    ]
  });
  assert.deepEqual(scene.audioCues, [
    { type: 'foley', startSeconds: 0.5, endSeconds: 1.25, description: 'Footsteps', characterId: 'Mira' },
    { type: 'music', startSeconds: 0, endSeconds: null, description: 'Theme', characterId: '' }
  ]);
});


test('scene normalization preserves physics actors, targets, transfers, and unknown contact state', () => {
  const scene = normalizeScene({
    id: 'physics-preservation',
    storyDetail: 'Mira throws the ball to Noah. Mira picks up the key.',
    physicsEvents: [
      {
        id: 'throw', type: 'throw', entityId: 'ball', actorId: 'Mira', targetId: 'Noah',
        contact: true, evidence: 'Mira throws the ball to Noah.'
      },
      {
        id: 'transfer', type: 'transfer', entityId: 'ball', fromEntityId: 'Mira', toEntityId: 'Noah',
        evidence: 'Mira throws the ball to Noah.'
      },
      {
        id: 'grasp', type: 'grasp', entityId: 'key', actorId: 'Mira',
        evidence: 'Mira picks up the key.'
      }
    ]
  });

  assert.equal(scene.physicsEvents[0].actorId, 'Mira');
  assert.equal(scene.physicsEvents[0].targetId, 'Noah');
  assert.equal(scene.physicsEvents[0].contact, true);
  assert.equal(scene.physicsEvents[1].fromEntityId, 'Mira');
  assert.equal(scene.physicsEvents[1].toEntityId, 'Noah');
  assert.equal(Object.hasOwn(scene.physicsEvents[2], 'contact'), false);

  const physics = buildScenePhysicsModel([scene]);
  assert.equal(physics.events[0].actorId, 'Mira');
  assert.equal(physics.events[0].targetId, 'Noah');
  assert.equal(physics.events[0].contactKnown, true);
  assert.equal(physics.events[1].fromEntityId, 'Mira');
  assert.equal(physics.events[1].toEntityId, 'Noah');
  assert.equal(physics.events[2].contactKnown, false);
});


test('scene normalization preserves explicit normalized prop positions and rejects invalid coordinates', () => {
  const scene = normalizeScene({
    stateChanges: [
      { entityType: 'prop', entityId: 'silver key', property: 'holder', previousValue: null, value: 'Mira', position: { x: 0.72, y: 0.55 } },
      { entityType: 'prop', entityId: 'broken key', property: 'holder', position: { x: 1.4, y: 0.55 } }
    ]
  });
  assert.deepEqual(scene.stateChanges[0].position, { x: 0.72, y: 0.55 });
  assert.equal(Object.hasOwn(scene.stateChanges[1], 'position'), false);
});

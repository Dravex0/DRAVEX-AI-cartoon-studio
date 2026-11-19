import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScenePhysicsModel } from '../src/scene-physics-model.js';

test('derives measured motion without inventing gravity or mass', () => {
  const model = buildScenePhysicsModel([{
    id: 'scene_1',
    storyDetail: 'Maya pushes the cart two meters forward.',
    physicsEvents: [{
      id: 'cart_motion', type: 'motion', entityId: 'cart',
      startPosition: { x: 0, y: 0, z: 0 },
      endPosition: { x: 2, y: 0, z: 0 },
      durationSeconds: 1,
      evidence: 'Maya pushes the cart two meters forward.'
    }]
  }]);

  assert.equal(model.groundedEventCount, 1);
  assert.equal(model.derivedMotionCount, 1);
  assert.deepEqual(model.events[0].derivedMotion.averageVelocityMps, { x: 2, y: 0, z: 0 });
  assert.equal(model.events[0].massKg, null);
  assert.deepEqual(model.environments, []);
});

test('derives a one-body collision impulse only from explicit mass and velocity measurements', () => {
  const model = buildScenePhysicsModel([{
    id: 'impact',
    storyDetail: 'The ball hits the wall and stops.',
    physicsEvents: [{
      type: 'collision', entityId: 'ball', otherEntityId: 'wall',
      massKg: 0.5,
      initialVelocityMps: { x: 4, y: 0, z: 0 },
      finalVelocityMps: { x: 0, y: 0, z: 0 },
      evidence: 'The ball hits the wall and stops.'
    }]
  }]);

  assert.deepEqual(model.events[0].derivedImpulseNs, { x: -2, y: 0, z: 0 });
  assert.equal(model.validation.issues.length, 0);
});

test('does not derive motion from unsupported or ungrounded claims', () => {
  const model = buildScenePhysicsModel([{
    id: 'scene_1',
    storyDetail: 'Maya watches the room.',
    physicsEvents: [{
      type: 'motion', entityId: 'crate',
      startPosition: { x: 0, y: 0, z: 0 },
      endPosition: { x: 10, y: 0, z: 0 },
      durationSeconds: 1,
      evidence: 'The crate slides across the room.'
    }]
  }]);

  assert.equal(model.events[0].grounded, false);
  assert.equal(model.events[0].derivedMotion, null);
  assert.ok(model.validation.issues.some(issue => issue.code === 'physics-event-source-unverified'));
});

test('keeps gravity unknown and reports a fall without measured environment gravity', () => {
  const model = buildScenePhysicsModel([{
    id: 'scene_1',
    storyDetail: 'The cup falls from the table.',
    physicsEvents: [{
      type: 'fall', entityId: 'cup',
      startPosition: { x: 0, y: 1, z: 0 },
      endPosition: { x: 0, y: 0, z: 0 },
      durationSeconds: 0.5,
      evidence: 'The cup falls from the table.'
    }]
  }]);

  assert.equal(model.environments.length, 0);
  assert.ok(model.validation.issues.some(issue => issue.code === 'fall-gravity-unknown'));
  assert.deepEqual(model.events[0].derivedMotion.displacementMeters, { x: 0, y: -1, z: 0 });
});

test('validates required collision and support participants', () => {
  const model = buildScenePhysicsModel([{
    id: 'scene_1',
    storyDetail: 'The box touches the floor.',
    physicsEvents: [
      { type: 'collision', entityId: 'box', evidence: 'The box touches the floor.' },
      { type: 'support', entityId: 'box', evidence: 'The box touches the floor.' }
    ]
  }]);

  assert.ok(model.validation.issues.some(issue => issue.code === 'collision-missing-other-body'));
  assert.ok(model.validation.issues.some(issue => issue.code === 'support-missing-surface'));
});

test('records explicit gravity but never supplies a default value', () => {
  const model = buildScenePhysicsModel([
    { id: 'earth', physics: { gravityMps2: 9.81, gravitySource: 'explicit scene setting' } },
    { id: 'unknown', physics: { gravityMps2: -1 } }
  ]);

  assert.deepEqual(model.environments, [
    { sceneId: 'earth', gravityMps2: 9.81, gravitySource: 'explicit scene setting' }
  ]);
});

test('handles malformed scene lists and event entries safely', () => {
  const empty = buildScenePhysicsModel(null);
  assert.equal(empty.eventCount, 0);

  const model = buildScenePhysicsModel([{ id: 'scene_1', physicsEvents: [null, 'bad'] }]);
  assert.equal(model.eventCount, 0);
  assert.equal(model.validation.issues.length, 2);
});


test('models grounded throw and catch actions with explicit participants and contact', () => {
  const model = buildScenePhysicsModel([{
    id: 'throw-catch',
    storyDetail: 'Mira throws the ball to Noah. Noah catches the ball.',
    physicsEvents: [
      { id: 'throw', type: 'throw', entityId: 'ball', actorId: 'Mira', targetId: 'Noah',
        contact: true, evidence: 'Mira throws the ball to Noah.' },
      { id: 'catch', type: 'catch', entityId: 'ball', actorId: 'Noah', targetId: 'ball',
        contact: true, evidence: 'Noah catches the ball.' }
    ]
  }], { entities: [{ id: 'Mira' }, { id: 'Noah' }, { id: 'ball' }] });

  assert.equal(model.groundedEventCount, 2);
  assert.equal(model.events[0].type, 'throw');
  assert.equal(model.events[0].actorId, 'Mira');
  assert.equal(model.events[0].targetId, 'Noah');
  assert.equal(model.events[0].contactKnown, true);
  assert.equal(model.events[1].type, 'catch');
  assert.equal(model.events[1].actorId, 'Noah');
  assert.equal(model.events[1].targetId, 'ball');
  assert.equal(model.validation.issues.length, 0);
});

test('keeps missing physical actors and holder transitions unresolved', () => {
  const model = buildScenePhysicsModel([{
    id: 'uncertain-transfer',
    storyDetail: 'The key changes hands.',
    physicsEvents: [
      { id: 'push', type: 'push', entityId: 'cart', evidence: 'The key changes hands.' },
      { id: 'handoff', type: 'transfer', entityId: 'key', evidence: 'The key changes hands.' }
    ]
  }]);

  assert.ok(model.validation.issues.some(issue => issue.code === 'physical-action-missing-actor'));
  assert.ok(model.validation.issues.some(issue => issue.code === 'transfer-missing-holder-transition'));
  assert.equal(model.events[1].fromEntityId, null);
  assert.equal(model.events[1].toEntityId, null);
});

test('checks physical participants against the known scene world', () => {
  const model = buildScenePhysicsModel([{
    id: 'scene-physical',
    storyDetail: 'Mira pushes the cart.',
    physicsEvents: [{
      id: 'push-cart', type: 'push', entityId: 'cart', actorId: 'Mira',
      evidence: 'Mira pushes the cart.'
    }]
  }], { entities: [{ id: 'cart' }] });

  assert.ok(model.validation.issues.some(issue =>
    issue.code === 'physics-participant-not-in-world-model'
    && issue.role === 'actor' && issue.entityId === 'Mira'
  ));
});

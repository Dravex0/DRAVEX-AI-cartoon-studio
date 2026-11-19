import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGroundedPhysicsVisualPlan } from '../src/scene-physics-visual-bridge.js';
const scene = { physicsEvents: [{ id: 'ball-flight', entityId: 'ball',
  visualStartPosition: { x: 0.1, y: 0.2 }, visualEndPosition: { x: 0.9, y: 0.8 },
  visualStartProgress: 0.2, visualEndProgress: 0.8 }] };
const model = { events: [{ id: 'ball-flight', entityId: 'ball', type: 'throw',
  grounded: true, evidence: 'Mira throws the ball.' }] };
test('samples grounded events with explicit viewport trajectories', () => {
  const sample = buildGroundedPhysicsVisualPlan(scene, model, 0.5)[0];
  assert.equal(sample.eventId, 'ball-flight');
  assert.equal(sample.active, true);
  assert.ok(Math.abs(sample.x - 0.5) < 1e-12);
  assert.ok(Math.abs(sample.y - 0.5) < 1e-12);
});
test('does not reinterpret physics meter positions as viewport coordinates', () => {
  const meterOnly = { physicsEvents: [{ id: 'ball-flight', entityId: 'ball',
    startPosition: { x: 0, y: 0, z: 0 }, endPosition: { x: 10, y: 5, z: 0 },
    visualStartProgress: 0, visualEndProgress: 1 }] };
  assert.deepEqual(buildGroundedPhysicsVisualPlan(meterOnly, model, 0.5), []);
});
test('rejects ungrounded events and invalid visual data', () => {
  assert.deepEqual(buildGroundedPhysicsVisualPlan(scene, { events: [{ ...model.events[0], grounded: false }] }, 0.5), []);
  const invalid = { physicsEvents: [{ ...scene.physicsEvents[0], visualEndPosition: { x: 2, y: 0.5 } }] };
  assert.deepEqual(buildGroundedPhysicsVisualPlan(invalid, model, 0.5), []);
});
test('clamps samples outside the authored event interval', () => {
  const before = buildGroundedPhysicsVisualPlan(scene, model, 0)[0];
  const after = buildGroundedPhysicsVisualPlan(scene, model, 1)[0];
  assert.equal(before.x, 0.1); assert.equal(after.x, 0.9);
  assert.equal(before.active, false); assert.equal(after.active, false);
});

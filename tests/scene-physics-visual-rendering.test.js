import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScenePropRenderPlan } from '../src/scene-prop-renderer.js';
import { normalizeScene } from '../src/scene-model.js';

test('renders a grounded throw along its explicitly authored viewport trajectory', () => {
  const scene = {
    id: 'throw-scene',
    storyDetail: 'Mira throws the ball across the room.',
    physicsEvents: [{
      id: 'throw-ball', type: 'throw', entityId: 'ball', actorId: 'Mira',
      evidence: 'Mira throws the ball across the room.',
      startPosition: { x: 0, y: 0, z: 0 }, endPosition: { x: 3, y: 0, z: 0 },
      visualStartPosition: { x: 0.1, y: 0.3 }, visualEndPosition: { x: 0.9, y: 0.7 },
      visualStartProgress: 0.2, visualEndProgress: 0.8
    }]
  };
  const plan = buildScenePropRenderPlan(scene, [], 0.5);
  const ball = plan.find(item => item.id === 'ball');
  assert.ok(ball);
  assert.equal(ball.physicsEventId, 'throw-ball');
  assert.equal(ball.x, 0.5);
  assert.equal(ball.y, 0.5);
});

test('normalization preserves explicit viewport trajectory separately from meter coordinates', () => {
  const scene = normalizeScene({ physicsEvents: [{
    id: 'move', type: 'motion', entityId: 'crate', evidence: 'The crate slides.',
    startPosition: { x: 1, y: 2, z: 3 },
    visualStartPosition: { x: 0.2, y: 0.4 },
    visualEndPosition: { x: 0.8, y: 0.6 },
    visualStartProgress: 0.1, visualEndProgress: 0.9
  }] });
  assert.deepEqual(scene.physicsEvents[0].visualStartPosition, { x: 0.2, y: 0.4 });
  assert.deepEqual(scene.physicsEvents[0].startPosition, { x: 1, y: 2, z: 3 });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createSceneGenerationGuard } from '../src/scene-generation-guard.js';

test('keeps a generation token current until the scene is edited', () => {
  const guard = createSceneGenerationGuard();
  const token = guard.capture('scene-1');
  assert.equal(guard.isCurrent(token), true);
  assert.equal(guard.isCurrent(guard.capture('scene-1')), true);
});

test('invalidating a scene makes all earlier in-flight tokens stale', () => {
  const guard = createSceneGenerationGuard();
  const first = guard.capture('scene-1');
  const second = guard.capture('scene-1');
  assert.equal(guard.invalidate('scene-1'), 1);
  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), false);
  assert.equal(guard.isCurrent(guard.capture('scene-1')), true);
});

test('revisions are isolated by stable scene ID', () => {
  const guard = createSceneGenerationGuard();
  const first = guard.capture('scene-1');
  const second = guard.capture('scene-2');
  guard.invalidate('scene-1');
  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
});

test('rejects missing IDs and malformed tokens', () => {
  const guard = createSceneGenerationGuard();
  assert.throws(() => guard.capture(''), /stable scene ID/);
  assert.equal(guard.isCurrent(null), false);
  assert.equal(guard.isCurrent({ sceneId: 'scene-1', revision: '0' }), false);
});

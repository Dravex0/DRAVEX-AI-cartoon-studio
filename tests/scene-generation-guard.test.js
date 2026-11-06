import test from 'node:test';
import assert from 'node:assert/strict';
import { createSceneGenerationGuard } from '../src/scene-generation-guard.js';

test('keeps a generation token current until the scene is edited', () => {
  const guard = createSceneGenerationGuard();
  const token = guard.capture('scene-1');
  assert.equal(guard.isCurrent(token), true);
  const newer = guard.capture('scene-1');
  assert.equal(guard.isCurrent(newer), true);
  assert.equal(guard.isCurrent(token), false);
});

test('invalidating a scene makes all earlier in-flight tokens stale', () => {
  const guard = createSceneGenerationGuard();
  const first = guard.capture('scene-1');
  const second = guard.capture('scene-1');
  assert.ok(guard.invalidate('scene-1') > second.revision);
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


test('storage revisions are stable for a generation and advance on edit', () => {
  const guard = createSceneGenerationGuard();
  const first = guard.capture('scene-storage');
  const repeated = guard.capture('scene-storage');
  assert.ok(repeated.storageRevision > first.storageRevision);
  assert.equal(guard.isCurrent(first), false);
  guard.invalidate('scene-storage');
  const next = guard.capture('scene-storage');
  assert.ok(next.storageRevision > repeated.storageRevision);
  assert.equal(guard.storageRevision('scene-storage'), next.storageRevision);
});

test('restored storage revisions are observed before new generation work', () => {
  const guard = createSceneGenerationGuard();
  const persistedRevision = Date.now() * 1000 + 500;
  assert.equal(guard.observeStorageRevision('scene-restore', persistedRevision), persistedRevision);
  const token = guard.capture('scene-restore');
  assert.ok(token.storageRevision > persistedRevision);
  assert.equal(guard.observeStorageRevision('scene-restore', persistedRevision - 1), token.storageRevision);
});

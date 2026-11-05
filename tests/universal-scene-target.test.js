import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveUniversalSceneTarget } from '../src/universal-scene-target.js';

const scenes = [{ id: 'scene-a' }, { id: 'scene-b' }, { id: 'scene-c' }];

test('resolves explicit zero-based index, one-based number and scene ID', () => {
  assert.equal(resolveUniversalSceneTarget({ inputs: ['sceneIndex:2'] }, scenes).index, 2);
  assert.equal(resolveUniversalSceneTarget({ inputs: ['sceneNumber:2'] }, scenes).index, 1);
  assert.equal(resolveUniversalSceneTarget({ inputs: ['sceneId:scene-b'] }, scenes).scene.id, 'scene-b');
});

test('resolves a scene number from action or purpose and otherwise preserves selected scene', () => {
  assert.equal(resolveUniversalSceneTarget({ action: 'Generate video for scene 3' }, scenes, 1).index, 2);
  assert.equal(resolveUniversalSceneTarget({ purpose: 'Animate scene #2' }, scenes).index, 1);
  assert.equal(resolveUniversalSceneTarget({}, scenes, 1).index, 1);
});

test('rejects unknown, out-of-range and conflicting scene targets', () => {
  assert.equal(resolveUniversalSceneTarget({ inputs: ['sceneId:missing'] }, scenes).reason, 'unknown-scene-id');
  assert.equal(resolveUniversalSceneTarget({ inputs: ['sceneNumber:9'] }, scenes).reason, 'scene-index-out-of-range');
  assert.equal(resolveUniversalSceneTarget({ inputs: ['sceneNumber:1', 'sceneNumber:2'] }, scenes).reason, 'conflicting-scene-targets');
  assert.equal(resolveUniversalSceneTarget({ action: 'Generate scene 1', purpose: 'Animate scene 2' }, scenes).reason, 'conflicting-scene-targets');
});

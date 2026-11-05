import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveUniversalVoiceTargets } from '../src/universal-voice-target.js';

const scenes = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];

test('resolves an explicit allScenes batch in storyboard order', () => {
  assert.deepEqual(resolveUniversalVoiceTargets({ inputs: ['allScenes'] }, scenes), {
    ok: true, allScenes: true, indices: [0, 1, 2]
  });
});

test('resolves one explicitly targeted scene', () => {
  const result = resolveUniversalVoiceTargets({ inputs: ['sceneNumber:2'] }, scenes);
  assert.equal(result.ok, true);
  assert.equal(result.allScenes, false);
  assert.deepEqual(result.indices, [1]);
  assert.equal(result.scene.id, 's2');
});

test('uses the selected scene as the fallback for a manual voice request', () => {
  const result = resolveUniversalVoiceTargets({}, scenes, 2);
  assert.equal(result.ok, true);
  assert.deepEqual(result.indices, [2]);
});

test('rejects allScenes combined with a single scene target', () => {
  assert.equal(resolveUniversalVoiceTargets({ inputs: ['allScenes', 'sceneNumber:2'] }, scenes).reason, 'conflicting-scene-targets');
  assert.equal(resolveUniversalVoiceTargets({ inputs: ['allScenes'], action: 'Generate voice for scene 2' }, scenes).reason, 'conflicting-scene-targets');
});

test('rejects unknown, out-of-range and missing scene targets', () => {
  assert.equal(resolveUniversalVoiceTargets({ inputs: ['sceneId:unknown'] }, scenes).reason, 'unknown-scene-id');
  assert.equal(resolveUniversalVoiceTargets({ inputs: ['sceneNumber:4'] }, scenes).reason, 'scene-index-out-of-range');
  assert.equal(resolveUniversalVoiceTargets({ inputs: ['allScenes'] }, []).reason, 'no-scenes-available');
});

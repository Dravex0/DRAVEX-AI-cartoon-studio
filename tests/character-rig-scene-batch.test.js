import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCharacterRigTimelinesForScenes } from '../src/character-rig-scene-batch.js';

test('generates timelines for every eligible scene and preserves existing ones', () => {
  const existing = { keyframes: [{ time: 0, poses: {} }] };
  const scenes = [
    { id: 'one', characterRigs: [{ characterId: 'Foxy' }] },
    { id: 'two', characterRigs: [{ characterId: 'Bear' }], characterRigTimeline: existing },
    { id: 'three', characterRigs: [{ characterId: 'Bird' }] },
    { id: 'four', characterRigs: [] }
  ];
  const calls = [];
  const result = generateCharacterRigTimelinesForScenes(scenes, (scene, rigs) => {
    calls.push([scene.id, rigs.length]);
    return { timeline: { keyframes: [{ time: 0, poses: { [scene.id]: {} } }] }, generatedCount: 2 };
  });

  assert.deepEqual(calls, [['one', 1], ['three', 1]]);
  assert.equal(result.generatedScenes, 2);
  assert.equal(result.generatedActions, 4);
  assert.equal(result.preservedTimelines, 1);
  assert.equal(result.scenesWithoutRig, 1);
  assert.equal(result.scenesWithoutActions, 0);
  assert.equal(result.scenes[1].characterRigTimeline, existing);
  assert.equal(result.scenes[0].characterRigTimeline.keyframes.length, 1);
  assert.equal(scenes[0].characterRigTimeline, undefined);
});

test('does not invent timelines for scenes without rigs or supported actions', () => {
  const result = generateCharacterRigTimelinesForScenes([
    { id: 'no-rig', characterRigs: [] },
    { id: 'no-action', characterRigs: [{ characterId: 'Foxy' }] }
  ], () => ({ timeline: null, reason: 'No supported actions.' }));

  assert.equal(result.generatedScenes, 0);
  assert.equal(result.scenesWithoutRig, 1);
  assert.equal(result.scenesWithoutActions, 1);
  assert.deepEqual(result.skipped, [{ sceneIndex: 1, reason: 'No supported actions.' }]);
  assert.equal(result.scenes[1].characterRigTimeline, undefined);
});

test('isolates a scene factory failure and continues with later scenes', () => {
  const result = generateCharacterRigTimelinesForScenes([
    { id: 'broken', characterRigs: [{ characterId: 'A' }] },
    { id: 'working', characterRigs: [{ characterId: 'B' }] }
  ], scene => {
    if (scene.id === 'broken') throw new Error('bad rig');
    return { timeline: { keyframes: [{ time: 0, poses: {} }] }, generatedCount: 1 };
  });

  assert.equal(result.generatedScenes, 1);
  assert.equal(result.scenesWithoutActions, 1);
  assert.deepEqual(result.skipped, [{ sceneIndex: 0, reason: 'bad rig' }]);
  assert.ok(result.scenes[1].characterRigTimeline);
});

test('rejects a missing timeline factory and handles non-array input safely', () => {
  assert.throws(() => generateCharacterRigTimelinesForScenes([], null), /factory is required/);
  assert.deepEqual(generateCharacterRigTimelinesForScenes(null, () => ({})), {
    scenes: [], generatedScenes: 0, generatedActions: 0,
    scenesWithoutRig: 0, scenesWithoutActions: 0, preservedTimelines: 0, skipped: []
  });
});

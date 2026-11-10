import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCharacterRigTimelinesForScenes } from '../src/character-rig-scene-batch.js';

test('generates timelines for every eligible scene and preserves existing ones', () => {
  const validTimeline = { schemaVersion: 1, keyframes: [{ time: 0, poses: {} }, { time: 1, poses: {} }] };
  const existing = validTimeline;
  const scenes = [
    { id: 'one', characterRigs: [{ characterId: 'Foxy' }] },
    { id: 'two', characterRigs: [{ characterId: 'Bear' }], characterRigTimeline: existing },
    { id: 'three', characterRigs: [{ characterId: 'Bird' }] },
    { id: 'four', characterRigs: [] }
  ];
  const calls = [];
  const result = generateCharacterRigTimelinesForScenes(scenes, (scene, rigs) => {
    calls.push([scene.id, rigs.length]);
    return { timeline: { schemaVersion: 1, keyframes: [{ time: 0, poses: {} }, { time: 1, poses: { [scene.id]: {} } }] }, generatedCount: 2 };
  });

  assert.deepEqual(calls, [['one', 1], ['three', 1]]);
  assert.equal(result.generatedScenes, 2);
  assert.equal(result.generatedActions, 4);
  assert.equal(result.preservedTimelines, 1);
  assert.equal(result.scenesWithoutRig, 1);
  assert.equal(result.scenesWithoutActions, 0);
  assert.equal(result.scenes[1].characterRigTimeline, existing);
  assert.equal(result.scenes[0].characterRigTimeline.keyframes.length, 2);
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
    return { timeline: { schemaVersion: 1, keyframes: [{ time: 0, poses: {} }, { time: 1, poses: {} }] }, generatedCount: 1 };
  });

  assert.equal(result.generatedScenes, 1);
  assert.equal(result.scenesWithoutActions, 1);
  assert.deepEqual(result.skipped, [{ sceneIndex: 0, reason: 'bad rig' }]);
  assert.ok(result.scenes[1].characterRigTimeline);
  assert.equal(result.scenes[1].characterRigTimeline.keyframes.length, 2);
});

test('rejects a missing timeline factory and handles non-array input safely', () => {
  assert.throws(() => generateCharacterRigTimelinesForScenes([], null), /factory is required/);
  assert.deepEqual(generateCharacterRigTimelinesForScenes(null, () => ({})), {
    scenes: [], generatedScenes: 0, generatedActions: 0,
    scenesWithoutRig: 0, scenesWithoutActions: 0, preservedTimelines: 0, skipped: []
  });
});


test('rejects generated timelines that violate the shared rig timeline schema', () => {
  const result = generateCharacterRigTimelinesForScenes([
    { id: 'invalid-generated', characterRigs: [{ characterId: 'Foxy' }] }
  ], () => ({
    timeline: { keyframes: [{ time: 0, poses: {} }] },
    generatedCount: 1
  }));

  assert.equal(result.generatedScenes, 0);
  assert.equal(result.scenesWithoutActions, 1);
  assert.equal(result.scenes[0].characterRigTimeline, undefined);
  assert.deepEqual(result.skipped, [{
    sceneIndex: 0,
    reason: 'generated-rig-timeline-invalid',
    issues: ['rig-timeline-schema-invalid', 'rig-timeline-keyframes-missing', 'rig-timeline-end-missing']
  }]);
});

test('replaces an explicitly supplied invalid timeline instead of preserving it', () => {
  const invalid = { schemaVersion: 2, keyframes: [{ time: 0, poses: {} }] };
  const valid = { schemaVersion: 1, keyframes: [{ time: 0, easing: 'linear', poses: {} }, { time: 1, easing: 'linear', poses: {} }] };
  const result = generateCharacterRigTimelinesForScenes([
    { id: 'repair-existing', characterRigs: [{ characterId: 'Foxy' }], characterRigTimeline: invalid }
  ], () => ({ timeline: valid, generatedCount: 1 }));

  assert.equal(result.generatedScenes, 1);
  assert.equal(result.preservedTimelines, 0);
  assert.deepEqual(result.scenes[0].characterRigTimeline, valid);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCharacterMotionTimelinesForScenes } from '../src/character-motion-scene-batch.js';

const timeline = { schemaVersion: 1, phases: [{
  phase: 'action', actorId: 'Foxy', start: 0.2, end: 0.8,
  description: 'Foxy walks right', evidence: 'Foxy walks right',
  motion: { from: { x: 0.2 }, to: { x: 0.4 } }
}] };

test('generates sprite motion for eligible scenes and preserves existing timelines', () => {
  const existing = { schemaVersion: 1, phases: [{ actorId: 'Bird', start: 0, end: 1 }] };
  const scenes = [
    { id: 'eligible', characterLayers: [{ characterId: 'Foxy' }] },
    { id: 'preserved', characterLayers: [{ characterId: 'Bird' }], characterMotionTimeline: existing },
    { id: 'no-sprite', characterLayers: [] },
    { id: 'no-layer-field' }
  ];
  const calls = [];
  const result = generateCharacterMotionTimelinesForScenes(scenes, (scene, layers) => {
    calls.push([scene.id, layers.length]);
    return { status: 'generated', timeline, generatedCount: 2 };
  });

  assert.deepEqual(calls, [['eligible', 1]]);
  assert.equal(result.generatedScenes, 1);
  assert.equal(result.generatedActions, 2);
  assert.equal(result.preservedTimelines, 1);
  assert.equal(result.scenesWithoutSprites, 2);
  assert.equal(result.scenesWithoutActions, 0);
  assert.equal(result.scenes[0].characterMotionTimeline, timeline);
  assert.equal(result.scenes[1].characterMotionTimeline, existing);
  assert.equal(scenes[0].characterMotionTimeline, undefined);
});

test('does not fabricate movement when the planner returns no supported timeline', () => {
  const result = generateCharacterMotionTimelinesForScenes([
    { id: 'no-action', characterLayers: [{ characterId: 'Foxy' }] }
  ], () => ({
    status: 'no-unambiguous-motion',
    reason: 'Direction or target is missing.',
    timeline: null,
    generatedCount: 0,
    skipped: [{ reason: 'motion-not-unambiguous' }]
  }));

  assert.equal(result.generatedScenes, 0);
  assert.equal(result.scenesWithoutActions, 1);
  assert.equal(result.scenes[0].characterMotionTimeline, undefined);
  assert.deepEqual(result.skipped, [
    { sceneIndex: 0, reason: 'Direction or target is missing.' },
    { sceneIndex: 0, skippedActions: 1 }
  ]);
});

test('isolates factory failures and continues processing later scenes', () => {
  const result = generateCharacterMotionTimelinesForScenes([
    { id: 'broken', characterLayers: [{ characterId: 'A' }] },
    { id: 'working', characterLayers: [{ characterId: 'B' }] }
  ], scene => {
    if (scene.id === 'broken') throw new Error('bad sprite');
    return { timeline, generatedCount: 1 };
  });

  assert.equal(result.generatedScenes, 1);
  assert.equal(result.scenesWithoutActions, 1);
  assert.deepEqual(result.skipped, [{ sceneIndex: 0, reason: 'bad sprite' }]);
  assert.ok(result.scenes[1].characterMotionTimeline);
});

test('rejects a missing factory and handles non-array scenes safely', () => {
  assert.throws(() => generateCharacterMotionTimelinesForScenes([], null), /factory is required/);
  assert.deepEqual(generateCharacterMotionTimelinesForScenes(null, () => ({})), {
    scenes: [], generatedScenes: 0, generatedActions: 0,
    scenesWithoutSprites: 0, scenesWithoutActions: 0,
    preservedTimelines: 0, skipped: []
  });
});

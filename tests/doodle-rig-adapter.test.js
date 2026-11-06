import test from 'node:test';
import assert from 'node:assert/strict';
import { compileDoodleSceneMotion, DOODLE_ACTION_PRESET_MAP } from '../src/doodle-rig-adapter.js';
import { sampleCharacterRigTimeline } from '../src/character-rig-timeline.js';

const rig = (characterId = 'Foxy') => ({
  schemaVersion: 1,
  characterId,
  bones: [
    { id: 'root' },
    { id: 'head', parentId: 'root' },
    { id: 'leftArm', parentId: 'root' },
    { id: 'rightArm', parentId: 'root' },
    { id: 'leftLeg', parentId: 'root' },
    { id: 'rightLeg', parentId: 'root' }
  ],
  parts: [{ id: 'body', boneId: 'root', imageUrl: 'blob:body' }]
});

test('maps Doodle actions onto existing project motion presets', () => {
  assert.equal(DOODLE_ACTION_PRESET_MAP.walk, 'walk');
  assert.equal(DOODLE_ACTION_PRESET_MAP.wave, 'wave');
  assert.equal(DOODLE_ACTION_PRESET_MAP.scared, 'defend');
  assert.equal(DOODLE_ACTION_PRESET_MAP.talk, 'idle');
});

test('compiles an existing character rig into the shared bone timeline', () => {
  const result = compileDoodleSceneMotion({ characters: ['Foxy'], action: 'wave' }, [rig()]);
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.animatedCharacterIds, ['Foxy']);
  assert.ok(result.timeline.keyframes.length >= 2);
  assert.equal(result.timeline.keyframes[0].time, 0);
  assert.equal(result.timeline.keyframes.at(-1).time, 1);
  assert.ok(sampleCharacterRigTimeline(result.timeline, 0.5).Foxy);
});

test('supports per-character actions and combines them into one scene timeline', () => {
  const result = compileDoodleSceneMotion(
    { characters: ['Foxy', 'Bird'], action: 'idle', characterActions: { Foxy: 'run', Bird: 'jump' } },
    [rig('Foxy'), rig('Bird')]
  );
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.animatedCharacterIds, ['Foxy', 'Bird']);
  for (const frame of result.timeline.keyframes) {
    assert.ok(frame.poses.Foxy);
    assert.ok(frame.poses.Bird);
  }
});

test('does not invent character identity when the cast is missing', () => {
  const result = compileDoodleSceneMotion({ action: 'walk' }, [rig()]);
  assert.equal(result.status, 'no-character-cast');
  assert.equal(result.timeline, null);
});

test('skips unsupported actions and missing rigs without fabricating motion', () => {
  const result = compileDoodleSceneMotion(
    { characters: ['Foxy', 'Wolf'], characterActions: { Foxy: 'teleport', Wolf: 'walk' } },
    [rig('Bird')]
  );
  assert.equal(result.status, 'no-compatible-rigs');
  assert.deepEqual(result.animatedCharacterIds, []);
  assert.equal(result.warnings.length, 2);
});

test('talk keeps body motion neutral and explicitly leaves mouth motion to existing LipSync', () => {
  const result = compileDoodleSceneMotion({ characters: ['Foxy'], action: 'talk' }, [rig()]);
  assert.equal(result.status, 'ready');
  assert.ok(result.warnings.some(warning => warning.includes('existing audio/viseme LipSync timeline')));
});

test('does not mutate scene or rig inputs', () => {
  const scene = { characters: ['Foxy'], action: 'walk' };
  const sourceRig = rig();
  const beforeScene = structuredClone(scene);
  const beforeRig = structuredClone(sourceRig);
  compileDoodleSceneMotion(scene, [sourceRig]);
  assert.deepEqual(scene, beforeScene);
  assert.deepEqual(sourceRig, beforeRig);
});

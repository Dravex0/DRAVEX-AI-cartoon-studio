import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHARACTER_MOTION_ACTIONS,
  CHARACTER_MOTION_CLIPS,
  getSceneCharacterMotion,
  resolveCharacterMotionAction,
  sampleCharacterMotion
} from '../src/character-motion.js';

test('exposes distinct reusable movement and reaction clips', () => {
  for (const action of ['idle', 'walk', 'run', 'jump', 'turn', 'talk', 'happy', 'sad', 'surprised', 'dance']) {
    assert.ok(CHARACTER_MOTION_ACTIONS.includes(action));
    assert.ok(CHARACTER_MOTION_CLIPS[action].keyframes.length >= 3);
  }
});

test('walk and run produce different poses through the cycle', () => {
  const walk = sampleCharacterMotion('walk', 0.25).pose;
  const run = sampleCharacterMotion('run', 0.25).pose;
  assert.notEqual(walk.y, run.y);
  assert.notEqual(walk.leftArm, run.leftArm);
});

test('jump moves through anticipation, airborne peak, and landing', () => {
  const anticipation = sampleCharacterMotion('jump', 0.22).pose;
  const airborne = sampleCharacterMotion('jump', 0.58).pose;
  const landing = sampleCharacterMotion('jump', 1).pose;
  assert.ok(airborne.y < anticipation.y);
  assert.ok(airborne.y < landing.y);
  assert.equal(landing.expression, 'neutral');
});

test('emotional clips provide expression states as well as body poses', () => {
  assert.equal(sampleCharacterMotion('happy', 0.5).pose.expression, 'happy');
  assert.equal(sampleCharacterMotion('sad', 0.5).pose.expression, 'sad');
  assert.equal(sampleCharacterMotion('surprised', 0.5).pose.expression, 'surprised');
});

test('interpolates numeric pose channels smoothly between keyframes', () => {
  const before = sampleCharacterMotion('turn', 0.35).pose.rotation;
  const middle = sampleCharacterMotion('turn', 0.5).pose.rotation;
  const after = sampleCharacterMotion('turn', 0.72).pose.rotation;
  assert.ok(middle > before && middle < after);
});

test('clamps invalid and out-of-range progress safely', () => {
  assert.equal(sampleCharacterMotion('walk', -4).progress, 0);
  assert.equal(sampleCharacterMotion('walk', 4).progress, 1);
  assert.equal(sampleCharacterMotion('walk', Number.NaN).progress, 0);
});

test('unknown actions fall back to idle without throwing', () => {
  const result = sampleCharacterMotion('teleport', 0.4);
  assert.equal(result.action, 'idle');
  assert.equal(result.pose.expression, 'neutral');
});

test('scene motion resolver uses explicit motion fields and safe fallback', () => {
  assert.equal(getSceneCharacterMotion({ characterMotion: 'run' }), 'run');
  assert.equal(getSceneCharacterMotion({ motionType: 'jump' }), 'jump');
  assert.equal(getSceneCharacterMotion({ action: 'dance' }), 'dance');
  assert.equal(getSceneCharacterMotion({ action: 'unknown' }), 'idle');
});

test('sampling does not mutate shared clip definitions', () => {
  const original = CHARACTER_MOTION_CLIPS.walk.keyframes[0].pose.leftArm;
  const result = sampleCharacterMotion('walk', 0.2);
  result.pose.leftArm = 999;
  assert.equal(CHARACTER_MOTION_CLIPS.walk.keyframes[0].pose.leftArm, original);
});

test('maps existing scene detector actions to supported character motion clips', () => {
  assert.equal(resolveCharacterMotionAction('float'), 'jump');
  assert.equal(resolveCharacterMotionAction('vanish'), 'idle');
  assert.equal(resolveCharacterMotionAction('magic'), 'idle');
  assert.equal(resolveCharacterMotionAction('happy'), 'happy');
  assert.equal(resolveCharacterMotionAction('run'), 'run');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { upsertCharacterMotionPhase } from '../src/character-motion-editor.js';

test('creates a normalized manual motion phase for a character', () => {
  const result = upsertCharacterMotionPhase(null, {
    actorId: 'Foxy', start: 0.1, end: 0.9,
    from: { x: 0.2, y: 0.7, ignored: 5 },
    to: { x: 0.8, y: 0.3, scale: 9, rotation: 0.2 }
  });
  assert.equal(result.schemaVersion, 1);
  assert.deepEqual(result.phases[0].motion.from, { x: 0.2, y: 0.7 });
  assert.deepEqual(result.phases[0].motion.to, { x: 0.8, y: 0.3, scale: 4, rotation: 0.2 });
});

test('updates only the selected character and preserves other motion phases', () => {
  const original = { schemaVersion: 1, phases: [
    { actorId: 'Foxy', start: 0, end: 1, motion: { to: { x: 0.5 } } },
    { actorId: 'Bird', start: 0.2, end: 0.8, motion: { to: { y: 0.4 } } }
  ] };
  const result = upsertCharacterMotionPhase(original, {
    actorId: 'foxy', start: 0.1, end: 0.7, from: { x: 0.5 }, to: { x: 0.9 }
  });
  assert.equal(result.phases.length, 2);
  assert.equal(result.phases.find(phase => phase.actorId === 'Bird').motion.to.y, 0.4);
  assert.equal(result.phases.find(phase => phase.actorId.toLowerCase() === 'foxy').motion.to.x, 0.9);
  assert.equal(original.phases[0].motion.to.x, 0.5);
});

test('rejects invalid actor, timing, and target pose', () => {
  assert.throws(() => upsertCharacterMotionPhase(null, { start: 0, end: 1, to: { x: 0.5 } }), /character ID/);
  assert.throws(() => upsertCharacterMotionPhase(null, { actorId: 'Foxy', start: 1, end: 1, to: { x: 0.5 } }), /timing/);
  assert.throws(() => upsertCharacterMotionPhase(null, { actorId: 'Foxy', start: 0, end: 1, to: { x: '0.5' } }), /target pose/);
});

test('limits motion phases to eight unique characters', () => {
  let timeline = null;
  for (let index = 0; index < 8; index += 1) {
    timeline = upsertCharacterMotionPhase(timeline, {
      actorId: 'Character ' + index, start: 0, end: 1, to: { x: 0.5 }
    });
  }
  assert.throws(() => upsertCharacterMotionPhase(timeline, {
    actorId: 'Ninth', start: 0, end: 1, to: { x: 0.5 }
  }), /at most eight/);
});

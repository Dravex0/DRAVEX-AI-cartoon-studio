import test from 'node:test';
import assert from 'node:assert/strict';
import { planCharacterMotionFromActionTimeline } from '../src/character-motion-planner.js';

const layers = [
  { characterId: 'Foxy', x: 0.25, y: 0.7, scale: 1, rotation: 0, opacity: 1 },
  { characterId: 'Bird', x: 0.75, y: 0.5, scale: 1, rotation: 0, opacity: 1 }
];
const makeScene = description => ({
  characters: ['Foxy', 'Bird'],
  characterCastProvided: true,
  storyDetail: 'Foxy ' + description,
  actionTimeline: {
    schemaVersion: 1,
    phases: [{
      phase: 'action', start: 0.2, end: 0.8, actorId: 'Foxy',
      targetId: null, description: 'Foxy ' + description,
      evidence: 'Foxy ' + description
    }]
  }
});

test('plans a directional walk only when direction is explicit and evidence is grounded', () => {
  const result = planCharacterMotionFromActionTimeline(makeScene('walks to the right'), layers);
  assert.equal(result.status, 'generated');
  assert.equal(result.generatedCount, 1);
  assert.equal(result.timeline.phases[0].motion.from.x, 0.25);
  assert.equal(result.timeline.phases[0].motion.to.x, 0.39);
});

test('plans a jump as a rise and landing pair with continuous poses', () => {
  const result = planCharacterMotionFromActionTimeline(makeScene('jumps over the stone'), layers);
  assert.equal(result.generatedCount, 2);
  const [rise, land] = result.timeline.phases;
  assert.equal(rise.start, 0.2);
  assert.equal(rise.end, 0.5);
  assert.equal(land.start, 0.5);
  assert.equal(land.end, 0.8);
  assert.equal(rise.motion.to.y, land.motion.from.y);
  assert.equal(land.motion.to.y, 0.7);
});

test('moves toward an explicitly named character target without inventing a direction', () => {
  const scene = makeScene('walks toward Bird');
  scene.actionTimeline.phases[0].targetId = 'Bird';
  const result = planCharacterMotionFromActionTimeline(scene, layers);
  assert.equal(result.generatedCount, 1);
  assert.ok(result.timeline.phases[0].motion.to.x > 0.25);
});

test('does not guess a direction for an unspecified walk', () => {
  const result = planCharacterMotionFromActionTimeline(makeScene('walks across the room'), layers);
  assert.equal(result.status, 'no-unambiguous-motion');
  assert.equal(result.timeline, null);
});

test('blocks an invalid or ungrounded action timeline', () => {
  const scene = makeScene('walks to the right');
  scene.actionTimeline.phases[0].evidence = 'invented phrase';
  const result = planCharacterMotionFromActionTimeline(scene, layers);
  assert.equal(result.status, 'blocked');
  assert.equal(result.timeline, null);
});

test('does not generate motion for an actor without a matching sprite', () => {
  const scene = makeScene('walks to the right');
  scene.actionTimeline.phases[0].actorId = 'Wolf';
  scene.characters = ['Wolf'];
  const result = planCharacterMotionFromActionTimeline(scene, layers);
  assert.equal(result.status, 'no-unambiguous-motion');
  assert.equal(result.skipped[0].reason, 'actor-sprite-missing');
});

test('does not mutate scene, action timeline, or sprite layers', () => {
  const scene = makeScene('jumps over the stone');
  const before = structuredClone(scene);
  const layerBefore = structuredClone(layers);
  planCharacterMotionFromActionTimeline(scene, layers);
  assert.deepEqual(scene, before);
  assert.deepEqual(layers, layerBefore);
});

test('assigns ease-out and ease-in profiles to jump rise and landing', () => {
  const result = planCharacterMotionFromActionTimeline(makeScene('jumps over the stone'), layers);
  assert.equal(result.timeline.phases[0].easing, 'ease-out');
  assert.equal(result.timeline.phases[1].easing, 'ease-in');
});

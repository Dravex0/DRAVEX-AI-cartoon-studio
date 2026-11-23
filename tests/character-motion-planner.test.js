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

test('plans a directional dodge as a sidestep and recovery for a flat sprite', () => {
  const result = planCharacterMotionFromActionTimeline(makeScene('dodges left from the incoming strike'), layers);
  assert.equal(result.status, 'generated');
  assert.equal(result.generatedCount, 2);
  const [evade, recover] = result.timeline.phases;
  assert.equal(evade.start, 0.2);
  assert.equal(evade.end, 0.5);
  assert.equal(evade.motion.to.x, 0.09);
  assert.equal(recover.start, 0.5);
  assert.equal(recover.end, 0.8);
  assert.equal(recover.motion.from.x, 0.09);
  assert.equal(recover.motion.to.x, 0.25);
  assert.equal(evade.easing, 'ease-out');
  assert.equal(recover.easing, 'ease-in');
});

test('plans a source-grounded attack lunge toward an explicitly named character and recovers', () => {
  const scene = makeScene('attacks Bird');
  scene.actionTimeline.phases[0].targetId = 'Bird';
  const result = planCharacterMotionFromActionTimeline(scene, layers);
  assert.equal(result.status, 'generated');
  assert.equal(result.generatedCount, 2);
  const [lunge, recover] = result.timeline.phases;
  assert.equal(lunge.start, 0.2);
  assert.ok(lunge.end > lunge.start && lunge.end < 0.8);
  assert.ok(lunge.motion.to.x > lunge.motion.from.x);
  assert.equal(recover.start, lunge.end);
  assert.equal(recover.end, 0.8);
  assert.deepEqual(recover.motion.to, lunge.motion.from);
  assert.match(lunge.description, /contact is not asserted/);
});

test('does not invent an attack direction when no named target sprite is available', () => {
  const result = planCharacterMotionFromActionTimeline(makeScene('attacks the monster'), layers);
  assert.equal(result.status, 'no-unambiguous-motion');
  assert.equal(result.timeline, null);
});

test('does not guess a direction for an ambiguous dodge', () => {
  const result = planCharacterMotionFromActionTimeline(makeScene('dodges the incoming strike'), layers);
  assert.equal(result.status, 'no-unambiguous-motion');
  assert.equal(result.timeline, null);
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


test('plans a semantic sidestep as an out-and-back dodge with rotation and compression', () => {
  const result = planCharacterMotionFromActionTimeline(makeScene('sidesteps quickly to the left'), layers);
  assert.equal(result.status, 'generated');
  assert.equal(result.generatedCount, 2);
  const [evade, recover] = result.timeline.phases;
  assert.equal(evade.easing, 'ease-out');
  assert.equal(recover.easing, 'ease-in');
  assert.ok(evade.motion.to.x < evade.motion.from.x);
  assert.ok(evade.motion.to.rotation < evade.motion.from.rotation);
  assert.ok(evade.motion.to.scale < evade.motion.from.scale);
  assert.deepEqual(recover.motion.to, evade.motion.from);
});

test('does not animate an ambiguous duck when no dodge direction is stated', () => {
  const result = planCharacterMotionFromActionTimeline(makeScene('ducks to avoid the falling branch'), layers);
  assert.equal(result.status, 'no-unambiguous-motion');
  assert.equal(result.timeline, null);
});


test('plans an accelerating pursuit toward an explicitly named chase target', () => {
  const scene = makeScene('chases Bird through the forest');
  scene.actionTimeline.phases[0].targetId = 'Bird';
  const result = planCharacterMotionFromActionTimeline(scene, layers);
  assert.equal(result.status, 'generated');
  assert.equal(result.generatedCount, 2);
  const [accelerate, pursue] = result.timeline.phases;
  assert.equal(accelerate.start, 0.2);
  assert.ok(accelerate.end > accelerate.start);
  assert.equal(pursue.start, accelerate.end);
  assert.equal(pursue.end, 0.8);
  assert.ok(accelerate.motion.to.scale > accelerate.motion.from.scale);
  assert.ok(pursue.motion.to.x > pursue.motion.from.x);
  assert.ok(pursue.motion.to.x < 0.75);
  assert.match(pursue.description, /no contact is implied/);
});

test('does not invent a chase target or pursuit direction when no named target sprite exists', () => {
  const result = planCharacterMotionFromActionTimeline(makeScene('chases a stranger through the forest'), layers);
  assert.equal(result.status, 'no-unambiguous-motion');
  assert.equal(result.timeline, null);
});

test('plans actions in scene-time order when actors are listed out of order', () => {
  const scene = {
    characters: ['Foxy', 'Bird'],
    characterCastProvided: true,
    storyDetail: 'Bird walks to the right. Foxy chases Bird.',
    actionTimeline: {
      schemaVersion: 1,
      phases: [{
        phase: 'action', start: 0.1, end: 0.9, actorId: 'Foxy',
        description: 'Bird walks to the right. Foxy chases Bird.',
        evidence: 'Bird walks to the right. Foxy chases Bird.',
        steps: [
          { intent: 'chase', motionCue: 'pursuit', start: 0.5, end: 0.9,
            actorId: 'Foxy', targetId: 'Bird', description: 'Foxy chases Bird.',
            evidence: 'Foxy chases Bird.' },
          { intent: 'walk', motionCue: 'travel', start: 0.1, end: 0.3,
            actorId: 'Bird', description: 'Bird walks to the right.',
            evidence: 'Bird walks to the right.' }
        ]
      }]
    }
  };
  const closeLayers = [
    { characterId: 'Foxy', x: 0.25, y: 0.7, scale: 1, rotation: 0, opacity: 1 },
    { characterId: 'Bird', x: 0.4, y: 0.5, scale: 1, rotation: 0, opacity: 1 }
  ];
  const result = planCharacterMotionFromActionTimeline(scene, closeLayers);
  assert.equal(result.status, 'generated');
  const birdMove = result.timeline.phases.find(item => item.actorId === 'Bird');
  const foxPursuit = result.timeline.phases.find(item =>
    item.actorId === 'Foxy' && item.description.includes('continue pursuit'));
  assert.ok(birdMove.motion.to.x > 0.4);
  assert.ok(foxPursuit.motion.to.x > 0.48,
    'Foxy should plan toward Bird after Bird has moved, not toward Bird\'s stale start pose');
});

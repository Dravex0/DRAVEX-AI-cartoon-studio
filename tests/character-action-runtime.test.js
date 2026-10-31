import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCharacterActionTimelineToLayers } from '../src/character-action-runtime.js';
import { drawCharacterLayers } from '../src/scene-character-layers.js';

const layers = [
  { characterId: 'Foxy', imageUrl: 'fox', x: 0.2, y: 0.7, scale: 1, opacity: 1 },
  { characterId: 'Bird', imageUrl: 'bird', x: 0.8, y: 0.3, scale: 1, opacity: 1 }
];
const timeline = {
  schemaVersion: 1,
  phases: [
    { phase: 'preparation', actorId: 'Foxy', start: 0, end: 0.25, motion: { to: { x: 0.3, y: 0.65 } } },
    { phase: 'action', actorId: 'Foxy', start: 0.25, end: 0.75, motion: { to: { x: 0.7, y: 0.4, rotation: 0.2, scale: 1.5 } } },
    { phase: 'reaction', actorId: 'Bird', start: 0.5, end: 1, motion: { from: { y: 0.3 }, to: { y: 0.6, opacity: 0.5 } } }
  ]
};

test('keeps base transforms before the first motion phase', () => {
  const result = applyCharacterActionTimelineToLayers(layers, timeline, 0);
  assert.equal(result[0].x, 0.2);
  assert.equal(result[0].y, 0.7);
});

test('interpolates the acting character transform inside its phase', () => {
  const result = applyCharacterActionTimelineToLayers(layers, timeline, 0.5);
  assert.equal(result[0].x, 0.5);
  assert.equal(result[0].y, 0.525);
  assert.equal(result[0].scale, 1.25);
  assert.equal(result[0].rotation, 0.1);
});

test('uses the exact target pose at phase end and persists it afterward', () => {
  const atEnd = applyCharacterActionTimelineToLayers(layers, timeline, 0.75);
  const afterEnd = applyCharacterActionTimelineToLayers(layers, timeline, 1);
  assert.equal(atEnd[0].x, 0.7);
  assert.equal(afterEnd[0].x, 0.7);
  assert.equal(afterEnd[0].scale, 1.5);
});

test('applies motion only to matching actors and supports multiple characters', () => {
  const result = applyCharacterActionTimelineToLayers(layers, timeline, 0.75);
  assert.equal(result[1].y, 0.45);
  assert.equal(result[1].opacity, 0.75);
  assert.equal(result[0].opacity, 1);
});

test('ignores unknown actors, malformed phases, and non-finite pose values', () => {
  const result = applyCharacterActionTimelineToLayers(
    [{ characterId: 'Foxy', x: 0.2 }],
    { schemaVersion: 1, phases: [
      { actorId: 'Wolf', start: 0, end: 1, motion: { to: { x: 0.9 } } },
      { actorId: 'Foxy', start: 0, end: 1, motion: { to: { x: 'NaN', y: null, scale: Infinity } } },
      { actorId: 'Foxy', start: null, end: 1, motion: { to: { x: 0.9 } } },
      null
    ] },
    0.5
  );
  assert.equal(result[0].x, 0.2);
});

test('clamps progress and derived pose values without mutating source layers or timeline', () => {
  const sourceLayers = [{ characterId: 'Foxy', x: 0.2, scale: 1 }];
  const sourceTimeline = { schemaVersion: 1, phases: [
    { actorId: 'Foxy', start: 0, end: 1, motion: { to: { x: 4, scale: 20, opacity: -2 } } }
  ] };
  const result = applyCharacterActionTimelineToLayers(sourceLayers, sourceTimeline, 2);
  assert.equal(result[0].x, 1);
  assert.equal(result[0].scale, 4);
  assert.equal(result[0].opacity, 0);
  assert.equal(sourceLayers[0].x, 0.2);
  assert.equal(sourceTimeline.phases[0].motion.to.x, 4);
  assert.notEqual(result[0], sourceLayers[0]);
});

test('invalid timeline or progress safely preserves layer geometry', () => {
  assert.deepEqual(applyCharacterActionTimelineToLayers(layers, null, 0.5), layers);
  assert.deepEqual(applyCharacterActionTimelineToLayers(layers, timeline, NaN), layers);
});

test('drawCharacterLayers consumes derived timeline transforms at render time', () => {
  const calls = [];
  const context = {
    globalAlpha: 1,
    save() {}, restore() {}, rotate() {}, scale() {},
    translate(...args) { calls.push(['translate', ...args]); },
    drawImage(...args) { calls.push(['drawImage', ...args]); }
  };
  drawCharacterLayers(context, [layers[0]], () => ({ naturalWidth: 10, naturalHeight: 10 }), 100, 100, {
    actionTimeline: timeline,
    progress: 0.5
  });
  assert.ok(calls.some(call => call[0] === 'translate' && call[1] === 50 && call[2] === 52.5));
});

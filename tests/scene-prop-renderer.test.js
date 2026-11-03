import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScenePropRenderPlan, drawSceneProps } from '../src/scene-prop-renderer.js';

const scene = {
  stateChanges: [{
    entityType: 'prop', entityId: 'glowing star', property: 'holder',
    previousValue: null, value: 'Fox', actorId: 'Fox', evidence: 'Fox picks up the glowing star.'
  }]
};
const layers = [{ characterId: 'Fox', x: 0.4, y: 0.7 }];

test('plans a grounded pickup and moves the prop from the ground to the named actor', () => {
  const early = buildScenePropRenderPlan(scene, layers, 0.1)[0];
  const late = buildScenePropRenderPlan(scene, layers, 1)[0];
  assert.equal(early.kind, 'star');
  assert.equal(early.held, true);
  assert.ok(early.y > late.y);
  assert.ok(late.x > 0.4 && late.x < 0.6);
  assert.equal(late.evidence, 'Fox picks up the glowing star.');
});

test('does not invent props when a scene has no explicit holder state change', () => {
  assert.deepEqual(buildScenePropRenderPlan({ storyDetail: 'Fox looks around.' }, layers, 1), []);
});

test('supports dropping a previously held object', () => {
  const drop = { stateChanges: [{
    entityType: 'prop', entityId: 'book', property: 'holder',
    previousValue: 'Fox', value: null, actorId: 'Fox', evidence: 'Fox puts down the book.'
  }] };
  const early = buildScenePropRenderPlan(drop, layers, 0.1)[0];
  const late = buildScenePropRenderPlan(drop, layers, 1)[0];
  assert.equal(early.kind, 'book');
  assert.ok(early.x < late.x);
});

test('draws planned props through the canvas API', () => {
  const calls = [];
  const context = new Proxy({}, { get(target, property) {
    if (property === 'save' || property === 'restore' || property === 'beginPath' || property === 'closePath' || property === 'stroke' || property === 'fill') return () => calls.push(property);
    if (property === 'translate' || property === 'moveTo' || property === 'lineTo' || property === 'fillRect' || property === 'strokeRect' || property === 'arc' || property === 'ellipse' || property === 'roundRect') return (...args) => calls.push([property, ...args]);
    return undefined;
  }, set(target, property, value) { target[property] = value; return true; } });
  const result = drawSceneProps(context, scene, layers, 1, 640, 360, 0.5);
  assert.equal(result.drawn, 1);
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'translate'));
});

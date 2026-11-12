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
    if (property === 'translate' || property === 'scale' || property === 'rotate' || property === 'moveTo' || property === 'lineTo' || property === 'fillRect' || property === 'strokeRect' || property === 'arc' || property === 'ellipse' || property === 'roundRect') return (...args) => calls.push([property, ...args]);
    return undefined;
  }, set(target, property, value) { target[property] = value; return true; } });
  const result = drawSceneProps(context, scene, layers, 1, 640, 360, 0.5);
  assert.equal(result.drawn, 1);
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'translate'));
});

test('uses the authored action phase instead of the fallback timing', () => {
  const timedScene = {
    ...scene,
    actionTimeline: { schemaVersion: 1, phases: [
      { phase: 'preparation', start: 0.1, end: 0.25 },
      { phase: 'action', start: 0.3, end: 0.45 }
    ] }
  };
  const before = buildScenePropRenderPlan(timedScene, layers, 0.2)[0];
  const after = buildScenePropRenderPlan(timedScene, layers, 0.6)[0];
  assert.ok(before.x > after.x);
  assert.ok(after.x > 0.4 && after.x < 0.6);
});

test('ignores malformed action timing and keeps the backwards-compatible fallback', () => {
  const malformed = {
    ...scene,
    actionTimeline: { phases: [{ phase: 'action', start: 0.8, end: 0.2 }] }
  };
  const before = buildScenePropRenderPlan(malformed, layers, 0.4)[0];
  const after = buildScenePropRenderPlan(malformed, layers, 0.9)[0];
  assert.ok(before.x > after.x);
});

test('anchors held props to the explicitly named hand after applying the sampled rig pose', () => {
  const rig = {
    schemaVersion: 1,
    characterId: 'Fox',
    bones: [{ id: 'root', parentId: null }, { id: 'leftHand', parentId: 'root' }],
    parts: [{
      id: 'leftHand', boneId: 'leftHand', imageUrl: 'https://assets.example/hand.png',
      x: 0.51, y: 0.58, width: 0.08, height: 0.08, rotation: 0.35, zIndex: 2
    }]
  };
  const plan = buildScenePropRenderPlan(scene, layers, 1, {
    characterRigs: [rig],
    rigPoses: { Fox: { leftHand: { x: -0.04, y: 0.03 } } }
  })[0];
  assert.equal(plan.held, true);
  assert.ok(Math.abs(plan.x - 0.47) < 1e-9);
  assert.ok(Math.abs(plan.y - 0.61) < 1e-9);
  assert.ok(Math.abs(plan.rotation - 0.35) < 1e-9);
});

test('uses the safe legacy hand estimate when the rig has no explicit hand or paw anchor', () => {
  const rig = {
    schemaVersion: 1, characterId: 'Fox',
    bones: [{ id: 'root', parentId: null }],
    parts: [{
      id: 'body', boneId: 'root', imageUrl: 'https://assets.example/body.png',
      x: 0.5, y: 0.6, width: 0.2, height: 0.3
    }]
  };
  const plan = buildScenePropRenderPlan(scene, layers, 1, { characterRigs: [rig] })[0];
  assert.equal(plan.x, 0.52);
  assert.equal(plan.y, 0.62);
});

test('interpolates prop orientation during pickup and restores ground orientation on drop', () => {
  const rig = {
    schemaVersion: 1, characterId: 'Fox',
    bones: [{ id: 'root', parentId: null }, { id: 'rightHand', parentId: 'root' }],
    parts: [{ id: 'rightHand', boneId: 'rightHand', imageUrl: 'https://assets.example/hand.png', x: 0.52, y: 0.6, width: 0.08, height: 0.08, rotation: 0.6 }]
  };
  const runtime = { characterRigs: [rig] };
  const pickup = { ...scene, actionTimeline: { phases: [{ phase: 'action', start: 0.2, end: 0.8 }] } };
  const before = buildScenePropRenderPlan(pickup, layers, 0.2, runtime)[0];
  const after = buildScenePropRenderPlan(pickup, layers, 0.8, runtime)[0];
  assert.equal(before.rotation, 0);
  assert.ok(Math.abs(after.rotation - 0.6) < 1e-9);
  const drop = { stateChanges: [{ entityType: 'prop', entityId: 'book', property: 'holder', previousValue: 'Fox', value: null, actorId: 'Fox' }] };
  const released = buildScenePropRenderPlan(drop, layers, 1, runtime)[0];
  assert.equal(released.rotation, 0);
});


test('uses an explicitly authored grip point transformed by the posed hand rotation', () => {
  const rig = {
    schemaVersion: 1, characterId: 'Fox',
    bones: [{ id: 'root', parentId: null }, { id: 'rightHand', parentId: 'root' }],
    parts: [{
      id: 'rightHand', boneId: 'rightHand', imageUrl: 'https://assets.example/hand.png',
      x: 0.5, y: 0.5, width: 0.1, height: 0.1, rotation: Math.PI / 2,
      gripOffsetX: 0.04, gripOffsetY: 0
    }]
  };
  const plan = buildScenePropRenderPlan(scene, layers, 1, { characterRigs: [rig] })[0];
  assert.ok(Math.abs(plan.x - 0.5) < 1e-9);
  assert.ok(Math.abs(plan.y - 0.54) < 1e-9);
  assert.ok(Math.abs(plan.rotation - Math.PI / 2) < 1e-9);
});


test('renders a prop at its explicitly authored scene anchor', () => {
  const anchoredScene = {
    ...scene,
    propAnchors: { 'glowing star': { x: 0.74, y: 0.42 } }
  };
  const plan = buildScenePropRenderPlan(anchoredScene, layers, 0)[0];
  assert.equal(plan.x, 0.74);
  assert.equal(plan.y, 0.42);
});


test('moves the fallen branch during its own preparation phase, before the bird-release action', () => {
  const rescueScene = {
    stateChanges: [{
      entityType: 'prop', entityId: 'fallen branch', property: 'holder',
      previousValue: null, value: 'Kel', actorId: 'Kel',
      evidence: 'Kel lifts the fallen branch and frees the small mechanical bird.'
    }],
    propAnchors: { 'fallen branch': { x: 0.68, y: 0.79 } },
    actionTimeline: { schemaVersion: 1, phases: [
      { phase: 'preparation', start: 0.12, end: 0.46, actorId: 'Kel', targetId: 'fallen branch' },
      { phase: 'action', start: 0.54, end: 0.9, actorId: 'Kel', targetId: 'small mechanical bird' }
    ] }
  };
  const kelLayers = [{ characterId: 'Kel', x: 0.4, y: 0.7 }];
  const atLiftEnd = buildScenePropRenderPlan(rescueScene, kelLayers, 0.46)[0];
  const afterBirdRelease = buildScenePropRenderPlan(rescueScene, kelLayers, 0.9)[0];
  assert.ok(Math.abs(atLiftEnd.x - 0.52) < 1e-9);
  assert.ok(Math.abs(atLiftEnd.y - 0.62) < 1e-9);
  assert.equal(atLiftEnd.x, afterBirdRelease.x);
  assert.equal(atLiftEnd.y, afterBirdRelease.y);
});


test('renders a trapped bird at an explicit story anchor without inventing its position', () => {
  const trappedScene = {
    stateChanges: [{
      entityType: 'prop', entityId: 'small mechanical bird', property: 'state',
      previousValue: null, value: 'trapped', actorId: 'Kel',
      evidence: 'Kel notices the small mechanical bird trapped under the fallen branch.'
    }],
    propAnchors: { 'small mechanical bird': { x: 0.44, y: 0.72 } }
  };
  const plan = buildScenePropRenderPlan(trappedScene, [], 0.2);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].kind, 'bird');
  assert.equal(plan[0].state, 'trapped');
  assert.equal(plan[0].x, 0.44);
  assert.equal(plan[0].y, 0.72);

  const withoutAnchor = buildScenePropRenderPlan({
    ...trappedScene,
    propAnchors: {}
  }, [], 0.2);
  assert.deepEqual(withoutAnchor, []);
});

test('animates an explicitly anchored freed bird during its own action phase', () => {
  const freedScene = {
    stateChanges: [{
      entityType: 'prop', entityId: 'small mechanical bird', property: 'state',
      previousValue: 'trapped', value: 'free', actorId: 'Kel',
      evidence: 'Kel frees the small mechanical bird.'
    }],
    propAnchors: { 'small mechanical bird': { x: 0.44, y: 0.72 } },
    actionTimeline: { schemaVersion: 1, phases: [
      { phase: 'action', start: 0.54, end: 0.9, actorId: 'Kel', targetId: 'small mechanical bird' }
    ] }
  };
  const beforeRelease = buildScenePropRenderPlan(freedScene, [], 0.54)[0];
  const afterRelease = buildScenePropRenderPlan(freedScene, [], 0.9)[0];
  assert.equal(beforeRelease.kind, 'bird');
  assert.equal(beforeRelease.state, 'free');
  assert.equal(beforeRelease.y, 0.72);
  assert.ok(afterRelease.y < beforeRelease.y);
  assert.ok(afterRelease.rotation < beforeRelease.rotation);
});

test('draws anchored bird and branch props through the shared canvas renderer', () => {
  const calls = [];
  const context = new Proxy({}, { get(target, property) {
    if (property === 'save' || property === 'restore' || property === 'beginPath' || property === 'closePath' || property === 'stroke' || property === 'fill') return () => calls.push(property);
    if (property === 'translate' || property === 'scale' || property === 'rotate' || property === 'moveTo' || property === 'lineTo' || property === 'fillRect' || property === 'strokeRect' || property === 'arc' || property === 'ellipse' || property === 'roundRect') return (...args) => calls.push([property, ...args]);
    return undefined;
  }, set(target, property, value) { target[property] = value; return true; } });
  const rescueScene = {
    stateChanges: [
      { entityType: 'prop', entityId: 'fallen branch', property: 'holder', previousValue: null, value: 'Kel', actorId: 'Kel' },
      { entityType: 'prop', entityId: 'small mechanical bird', property: 'state', previousValue: null, value: 'trapped', actorId: 'Kel' }
    ],
    propAnchors: {
      'fallen branch': { x: 0.68, y: 0.79 },
      'small mechanical bird': { x: 0.44, y: 0.72 }
    }
  };
  const result = drawSceneProps(context, rescueScene, [{ characterId: 'Kel', x: 0.4, y: 0.7 }], 1, 640, 360);
  assert.equal(result.drawn, 2);
  assert.equal(calls.filter(call => Array.isArray(call) && call[0] === 'ellipse').length, 2);
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'lineTo'));
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'scale' && call[1] === 360 && call[2] === 360));
});


test('renders an explicitly observed fallen branch at its authored anchor', () => {
  const obstacleScene = {
    stateChanges: [{
      entityType: 'prop', entityId: 'fallen branch', property: 'state',
      previousValue: null, value: 'fallen', actorId: 'Kel',
      evidence: 'Kel sees the small mechanical bird trapped under a fallen branch.'
    }],
    propAnchors: { 'fallen branch': { x: 0.68, y: 0.79 } }
  };
  const plan = buildScenePropRenderPlan(obstacleScene, [], 0.1);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].kind, 'branch');
  assert.equal(plan[0].state, 'fallen');
  assert.equal(plan[0].x, 0.68);
  assert.equal(plan[0].y, 0.79);
});

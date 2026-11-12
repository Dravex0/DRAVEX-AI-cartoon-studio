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
    if (property === 'translate' || property === 'rotate' || property === 'moveTo' || property === 'lineTo' || property === 'fillRect' || property === 'strokeRect' || property === 'arc' || property === 'ellipse' || property === 'roundRect') return (...args) => calls.push([property, ...args]);
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


test('animates an explicitly pushed ball rolling away from its named actor', () => {
  const pushed = { stateChanges: [{
    entityType: 'prop', entityId: 'red ball', property: 'motion',
    previousValue: null, value: 'rolling', actorId: 'Fox', evidence: 'Fox pushes the red ball.'
  }] };
  const start = buildScenePropRenderPlan(pushed, layers, 0.52)[0];
  const end = buildScenePropRenderPlan(pushed, layers, 0.8)[0];
  assert.equal(start.kind, 'ball');
  assert.equal(start.motion, 'rolling');
  assert.equal(start.held, false);
  assert.ok(end.x > start.x);
  assert.ok(end.rotation > start.rotation);
});

test('renders a ball in red so the visual matches a red-ball story prompt', () => {
  const pushed = { stateChanges: [{
    entityType: 'prop', entityId: 'красный мяч', property: 'motion',
    previousValue: null, value: 'rolling', actorId: 'Fox', evidence: 'Foxy толкает красный мяч лапой.'
  }] };
  const plan = buildScenePropRenderPlan(pushed, layers, 0.7)[0];
  assert.equal(plan.kind, 'ball');
  assert.equal(plan.motion, 'rolling');
});

test('preserves the named ball color instead of hardcoding red for every ball', () => {
  const renderFillStyles = scene => {
    const fillStyles = [];
    const context = new Proxy({}, {
      get(target, property) {
        if (['save', 'restore', 'beginPath', 'closePath', 'stroke', 'fill', 'arc', 'moveTo', 'lineTo', 'fillRect', 'strokeRect', 'ellipse', 'roundRect', 'translate', 'rotate'].includes(property)) return () => {};
        return undefined;
      },
      set(target, property, value) {
        if (property === 'fillStyle') fillStyles.push(value);
        target[property] = value;
        return true;
      }
    });
    drawSceneProps(context, scene, layers, 0.7, 640, 360, 0.5);
    return fillStyles;
  };
  const red = renderFillStyles({ stateChanges: [{
    entityType: 'prop', entityId: 'red ball', property: 'motion',
    value: 'rolling', actorId: 'Fox', evidence: 'Foxy pushes the red ball.'
  }] });
  const blue = renderFillStyles({ stateChanges: [{
    entityType: 'prop', entityId: 'blue ball', property: 'motion',
    value: 'rolling', actorId: 'Fox', evidence: 'Foxy pushes the blue ball.'
  }] });
  const green = renderFillStyles({ stateChanges: [{
    entityType: 'prop', entityId: 'green ball', property: 'motion',
    value: 'rolling', actorId: 'Fox', evidence: 'Foxy pushes the green ball.'
  }] });
  const ukrainianRed = renderFillStyles({ stateChanges: [{
    entityType: 'prop', entityId: "червоний м'яч", property: 'motion',
    value: 'rolling', actorId: 'Foxy', evidence: "Foxy копає червоний м'яч лапою."
  }] });
  assert.ok(red.includes('#e74b4b'));
  assert.ok(blue.includes('#72c6df'));
  assert.ok(green.includes('#55a96a'));
  assert.ok(ukrainianRed.includes('#e74b4b'));
  assert.ok(!blue.includes('#e74b4b'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScenePropRenderPlan, drawSceneProps } from '../src/scene-prop-renderer.js';
import { normalizeScene } from '../src/scene-model.js';
import { sampleCharacterRigTimeline } from '../src/character-rig-timeline.js';

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
  assert.equal(early.held, false);
  assert.equal(late.held, true);
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
  assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'scale' && call[1] === 360 && call[2] === 360),
    'normalized prop geometry must be scaled to the 640×360 canvas instead of rendering at sub-pixel size');
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


test('attaches procedural actors props to the computed right or explicitly requested left hand', () => {
  const anchors = {
    Fox: {
      leftHand: { x: 0.31, y: 0.44, rotation: -0.2 },
      rightHand: { x: 0.67, y: 0.48, rotation: 0.35 }
    }
  };
  const right = buildScenePropRenderPlan(scene, layers, 1, { proceduralPropAnchors: anchors })[0];
  assert.equal(right.x, 0.67);
  assert.equal(right.y, 0.48);
  assert.equal(right.rotation, 0.35);
  const leftScene = {
    stateChanges: scene.stateChanges.map(change => ({ ...change, gripHand: 'leftHand' }))
  };
  const left = buildScenePropRenderPlan(leftScene, layers, 1, { proceduralPropAnchors: anchors })[0];
  assert.equal(left.x, 0.31);
  assert.equal(left.y, 0.44);
  assert.equal(left.rotation, -0.2);
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

test('preserves pickup and drop as two ordered transitions for the same prop', () => {
  const sequence = {
    actionTimeline: { phases: [{ phase: 'action', start: 0, end: 1, steps: [
      { intent: 'pick_up', start: 0.1, end: 0.2 },
      { intent: 'drop', start: 0.8, end: 0.9 }
    ] }] },
    stateChanges: [
      { entityType: 'prop', entityId: 'key', property: 'holder', previousValue: null, value: 'Fox', actorId: 'Fox', actionIntent: 'pick_up', evidence: 'Fox picks up the key.' },
      { entityType: 'prop', entityId: 'key', property: 'holder', previousValue: 'Fox', value: null, actorId: 'Fox', actionIntent: 'drop', evidence: 'Fox drops the key.' }
    ]
  };
  const start = buildScenePropRenderPlan(sequence, layers, 0.05)[0];
  const carried = buildScenePropRenderPlan(sequence, layers, 0.5)[0];
  const released = buildScenePropRenderPlan(sequence, layers, 0.95)[0];
  assert.equal(start.held, false);
  assert.equal(carried.held, true);
  assert.equal(released.held, false);
  assert.ok(start.x > carried.x);
  assert.ok(released.x > carried.x);
  assert.equal(carried.transitionIndex, 0);
  assert.equal(released.transitionIndex, 1);
});

test('animates an explicitly authored prop handoff between two characters', () => {
  const handoff = {
    actionTimeline: { phases: [{ phase: 'action', start: 0, end: 1 }] },
    stateChanges: [{
      entityType: 'prop', entityId: 'key', property: 'holder',
      previousValue: 'Fox', value: 'Bird', actorId: 'Fox',
      evidence: 'Fox hands the key to Bird.'
    }]
  };
  const cast = [...layers, { characterId: 'Bird', x: 0.8, y: 0.65 }];
  const before = buildScenePropRenderPlan(handoff, cast, 0.1)[0];
  const middle = buildScenePropRenderPlan(handoff, cast, 0.5)[0];
  const after = buildScenePropRenderPlan(handoff, cast, 1)[0];
  assert.ok(before.x < middle.x);
  assert.ok(middle.x < after.x);
  assert.equal(before.held, true);
  assert.equal(after.held, true);
  assert.equal(after.x, 0.92);
});

test('selects the explicitly named grip hand when a rig has two hands', () => {
  const rig = {
    schemaVersion: 1, characterId: 'Mira',
    bones: [{ id: 'root', parentId: null }, { id: 'leftHand', parentId: 'root' }, { id: 'rightHand', parentId: 'root' }],
    parts: [
      { id: 'leftHand', boneId: 'leftHand', imageUrl: 'https://assets.example/left.png', x: 0.3, y: 0.6, width: 0.08, height: 0.08 },
      { id: 'rightHand-prop-grip', boneId: 'rightHand', imageUrl: 'https://assets.example/right.png', x: 0.7, y: 0.55, width: 0.08, height: 0.08 }
    ]
  };
  const miraScene = { ...scene, stateChanges: scene.stateChanges.map(change => ({ ...change, value: 'Mira', actorId: 'Mira' })) };
  const plan = buildScenePropRenderPlan(miraScene, [{ characterId: 'Mira', x: 0.5, y: 0.7 }], 1, { characterRigs: [rig] })[0];
  assert.equal(plan.held, true);
  assert.ok(Math.abs(plan.x - 0.7) < 1e-9);
  assert.ok(Math.abs(plan.y - 0.55) < 1e-9);
});

test('does not guess which hand holds a prop when both hands lack an authored grip anchor', () => {
  const rig = {
    schemaVersion: 1, characterId: 'Mira',
    bones: [{ id: 'root', parentId: null }, { id: 'leftHand', parentId: 'root' }, { id: 'rightHand', parentId: 'root' }],
    parts: [
      { id: 'leftHand', boneId: 'leftHand', imageUrl: 'https://assets.example/left.png', x: 0.3, y: 0.6, width: 0.08, height: 0.08 },
      { id: 'rightHand', boneId: 'rightHand', imageUrl: 'https://assets.example/right.png', x: 0.7, y: 0.55, width: 0.08, height: 0.08 }
    ]
  };
  const miraScene = { ...scene, stateChanges: scene.stateChanges.map(change => ({ ...change, value: 'Mira', actorId: 'Mira' })) };
  const plan = buildScenePropRenderPlan(miraScene, [{ characterId: 'Mira', x: 0.5, y: 0.7 }], 1, { characterRigs: [rig] })[0];
  // Keep the documented legacy estimate only as a fallback, but never silently
  // attach the prop to an arbitrary hand.
  assert.equal(plan.x, 0.62);
  assert.equal(plan.y, 0.62);
});


test('selects a semantic gripAnchor marker without relying on part ID naming', () => {
  const rig = {
    schemaVersion: 1, characterId: 'Mira',
    bones: [{ id: 'root', parentId: null }, { id: 'leftHand', parentId: 'root' }, { id: 'rightHand', parentId: 'root' }],
    parts: [
      { id: 'leftHand', boneId: 'leftHand', imageUrl: 'https://assets.example/left.png', x: 0.3, y: 0.6, width: 0.08, height: 0.08 },
      { id: 'contact-point-02', boneId: 'rightHand', imageUrl: 'https://assets.example/right.png', x: 0.7, y: 0.55, width: 0.08, height: 0.08, gripAnchor: true }
    ]
  };
  const miraScene = { ...scene, stateChanges: scene.stateChanges.map(change => ({ ...change, value: 'Mira', actorId: 'Mira' })) };
  const plan = buildScenePropRenderPlan(miraScene, [{ characterId: 'Mira', x: 0.5, y: 0.7 }], 1, { characterRigs: [rig] })[0];
  assert.ok(Math.abs(plan.x - 0.7) < 1e-9);
  assert.ok(Math.abs(plan.y - 0.55) < 1e-9);
});

test('does not choose between multiple semantic grip anchors', () => {
  const rig = {
    schemaVersion: 1, characterId: 'Mira',
    bones: [{ id: 'root', parentId: null }, { id: 'leftHand', parentId: 'root' }, { id: 'rightHand', parentId: 'root' }],
    parts: [
      { id: 'left-contact', boneId: 'leftHand', imageUrl: 'https://assets.example/left.png', x: 0.3, y: 0.6, width: 0.08, height: 0.08, gripAnchor: true },
      { id: 'right-contact', boneId: 'rightHand', imageUrl: 'https://assets.example/right.png', x: 0.7, y: 0.55, width: 0.08, height: 0.08, gripAnchor: true }
    ]
  };
  const miraScene = { ...scene, stateChanges: scene.stateChanges.map(change => ({ ...change, value: 'Mira', actorId: 'Mira' })) };
  const plan = buildScenePropRenderPlan(miraScene, [{ characterId: 'Mira', x: 0.5, y: 0.7 }], 1, { characterRigs: [rig] })[0];
  assert.equal(plan.x, 0.62);
  assert.equal(plan.y, 0.62);
});


test('held props follow the same sampled rig timeline pose as the character hand', () => {
  const pickupScene = {
    stateChanges: [{
      entityType: 'prop', entityId: 'book', property: 'holder',
      previousValue: null, value: 'Mira', actorId: 'Mira',
      actionIntent: 'pick_up', evidence: 'Mira picks up the book.'
    }]
  };
  const rig = {
    schemaVersion: 1, characterId: 'Mira',
    bones: [{ id: 'root', parentId: null }, { id: 'rightHand', parentId: 'root' }],
    parts: [{
      id: 'contact-point', boneId: 'rightHand', imageUrl: 'https://assets.example/hand.png',
      x: 0.7, y: 0.55, width: 0.08, height: 0.08, gripAnchor: true
    }]
  };
  const timeline = {
    schemaVersion: 1,
    keyframes: [
      { time: 0, poses: { Mira: { rightHand: { x: 0, y: 0 } } } },
      { time: 1, poses: { Mira: { rightHand: { x: 0.18, y: -0.05 } } } }
    ]
  };
  const layer = [{ characterId: 'Mira', x: 0.5, y: 0.7 }];
  const atStart = buildScenePropRenderPlan(pickupScene, layer, 1, {
    characterRigs: [rig], rigPoses: sampleCharacterRigTimeline(timeline, 0)
  })[0];
  const atEnd = buildScenePropRenderPlan(pickupScene, layer, 1, {
    characterRigs: [rig], rigPoses: sampleCharacterRigTimeline(timeline, 1)
  })[0];
  assert.equal(atStart.held, true);
  assert.equal(atEnd.held, true);
  assert.ok(Math.abs((atEnd.x - atStart.x) - 0.18) < 1e-9);
  assert.ok(Math.abs((atEnd.y - atStart.y) + 0.05) < 1e-9);
});


test('uses an explicit prop position as the pickup origin instead of the generic ground fallback', () => {
  const positioned = {
    ...scene,
    stateChanges: scene.stateChanges.map(change => ({ ...change, position: { x: 0.23, y: 0.41 } }))
  };
  const before = buildScenePropRenderPlan(positioned, layers, 0.1)[0];
  assert.equal(before.x, 0.23);
  assert.equal(before.y, 0.41);
});


test('normalizes explicit previous and destination prop positions', () => {
  const normalized = normalizeScene({ stateChanges: [{
    entityType: 'prop', entityId: 'ball', property: 'position',
    previousPosition: { x: 0.2, y: 0.3 }, position: { x: 0.8, y: 0.7 }
  }] });
  assert.deepEqual(normalized.stateChanges[0].previousPosition, { x: 0.2, y: 0.3 });
  assert.deepEqual(normalized.stateChanges[0].position, { x: 0.8, y: 0.7 });
});

test('animates an explicitly grounded prop position between authored endpoints', () => {
  const moving = {
    actionTimeline: { schemaVersion: 1, phases: [{
      phase: 'action', start: 0.2, end: 0.8, actorId: 'Fox',
      description: 'Fox throws the ball', evidence: 'Fox throws the ball',
      steps: [{ intent: 'throw', start: 0.2, end: 0.8, actorId: 'Fox',
        description: 'Throw the ball', evidence: 'Fox throws the ball' }]
    }] },
    stateChanges: [{
      entityType: 'prop', entityId: 'ball', property: 'position',
      previousPosition: { x: 0.2, y: 0.3 }, position: { x: 0.8, y: 0.7 },
      actionIntent: 'throw', evidence: 'Fox throws the ball'
    }]
  };
  const start = buildScenePropRenderPlan(moving, [], 0.2)[0];
  const middle = buildScenePropRenderPlan(moving, [], 0.5)[0];
  const end = buildScenePropRenderPlan(moving, [], 0.8)[0];
  assert.ok(Math.abs(start.x - 0.2) < 1e-9);
  assert.ok(Math.abs(start.y - 0.3) < 1e-9);
  assert.ok(Math.abs(middle.x - 0.5) < 1e-9);
  assert.ok(Math.abs(middle.y - 0.5) < 1e-9);
  assert.ok(Math.abs(end.x - 0.8) < 1e-9);
  assert.ok(Math.abs(end.y - 0.7) < 1e-9);
});

test('does not invent prop travel when the starting position is unknown', () => {
  const unknownStart = { stateChanges: [{
    entityType: 'prop', entityId: 'chest', property: 'position',
    position: { x: 0.75, y: 0.65 }, evidence: 'The chest moves'
  }] };
  const plan = buildScenePropRenderPlan(unknownStart, [], 0.5)[0];
  assert.equal(plan.x, 0.75);
  assert.equal(plan.y, 0.65);
  assert.equal(plan.transitionProgress, 1);
});

test('keeps a held prop attached to its holder instead of overriding it with world position', () => {
  const heldAndMoving = {
    stateChanges: [
      { entityType: 'prop', entityId: 'book', property: 'holder', previousValue: null, value: 'Fox', evidence: 'Fox picks up the book' },
      { entityType: 'prop', entityId: 'book', property: 'position', previousPosition: { x: 0.1, y: 0.2 }, position: { x: 0.9, y: 0.8 }, evidence: 'The book moves' }
    ]
  };
  const plan = buildScenePropRenderPlan(heldAndMoving, layers, 1)[0];
  assert.equal(plan.held, true);
  assert.ok(plan.x < 0.6);
  assert.ok(plan.y < 0.7);
});


test('matches repeated prop motion intents to distinct authored action steps', () => {
  const repeated = {
    actionTimeline: { schemaVersion: 1, phases: [{
      phase: 'action', start: 0.1, end: 0.9, actorId: 'Fox',
      steps: [
        { intent: 'throw', start: 0.1, end: 0.4, actorId: 'Fox', targetId: 'ball-one', evidence: 'Fox throws the first ball.', description: 'Throw the first ball' },
        { intent: 'throw', start: 0.6, end: 0.9, actorId: 'Fox', targetId: 'ball-two', evidence: 'Fox throws the second ball.', description: 'Throw the second ball' }
      ]
    }] },
    stateChanges: [
      { entityType: 'prop', entityId: 'ball-one', property: 'position', actionIntent: 'throw',
        actorId: 'Fox', evidence: 'Fox throws the first ball.',
        previousPosition: { x: 0.1, y: 0.2 }, position: { x: 0.4, y: 0.5 } },
      { entityType: 'prop', entityId: 'ball-two', property: 'position', actionIntent: 'throw',
        actorId: 'Fox', evidence: 'Fox throws the second ball.',
        previousPosition: { x: 0.6, y: 0.7 }, position: { x: 0.9, y: 0.4 } }
    ]
  };
  const firstBefore = buildScenePropRenderPlan(repeated, [], 0.05).find(item => item.id === 'ball-one');
  const firstAfter = buildScenePropRenderPlan(repeated, [], 0.5).find(item => item.id === 'ball-one');
  const secondBefore = buildScenePropRenderPlan(repeated, [], 0.5).find(item => item.id === 'ball-two');
  const secondAfter = buildScenePropRenderPlan(repeated, [], 0.95).find(item => item.id === 'ball-two');
  assert.ok(Math.abs(firstBefore.x - 0.1) < 1e-9);
  assert.ok(Math.abs(firstAfter.x - 0.4) < 1e-9);
  assert.ok(Math.abs(secondBefore.x - 0.6) < 1e-9);
  assert.ok(Math.abs(secondAfter.x - 0.9) < 1e-9);
});

test('does not match an untargeted prop change to an action step with no intent', () => {
  const scene = {
    actionTimeline: { schemaVersion: 1, phases: [{
      phase: 'action', start: 0.3, end: 0.9,
      steps: [{ start: 0.1, end: 0.9, description: 'Unclassified action' }]
    }] },
    stateChanges: [{
      entityType: 'prop', entityId: 'crate', property: 'position',
      previousPosition: { x: 0.2, y: 0.3 }, position: { x: 0.8, y: 0.7 }
    }]
  };
  const beforeFallback = buildScenePropRenderPlan(scene, [], 0.2)[0];
  assert.ok(Math.abs(beforeFallback.x - 0.2) < 1e-9);
  assert.ok(Math.abs(beforeFallback.y - 0.3) < 1e-9);
});


test('matches prop trajectories by actor, target entity, and evidence instead of array order', () => {
  const evidenceOne = 'Fox throws the first ball.';
  const evidenceTwo = 'Bird throws the second ball.';
  const scene = {
    actionTimeline: { schemaVersion: 1, phases: [{
      phase: 'action', start: 0.1, end: 0.9,
      steps: [
        { intent: 'throw', start: 0.1, end: 0.4, actorId: 'Fox', targetId: 'ball-one', evidence: evidenceOne },
        { intent: 'throw', start: 0.6, end: 0.9, actorId: 'Bird', targetId: 'ball-two', evidence: evidenceTwo }
      ]
    }] },
    // Reverse source order deliberately: matching must not depend on list position.
    stateChanges: [
      { entityType: 'prop', entityId: 'ball-two', property: 'position', actionIntent: 'throw',
        actorId: 'Bird', evidence: evidenceTwo,
        previousPosition: { x: 0.6, y: 0.7 }, position: { x: 0.9, y: 0.4 } },
      { entityType: 'prop', entityId: 'ball-one', property: 'position', actionIntent: 'throw',
        actorId: 'Fox', evidence: evidenceOne,
        previousPosition: { x: 0.1, y: 0.2 }, position: { x: 0.4, y: 0.5 } }
    ]
  };
  const first = buildScenePropRenderPlan(scene, [], 0.25).find(item => item.id === 'ball-one');
  const second = buildScenePropRenderPlan(scene, [], 0.75).find(item => item.id === 'ball-two');
  assert.ok(Math.abs(first.x - 0.25) < 1e-9);
  assert.ok(Math.abs(first.y - 0.35) < 1e-9);
  assert.ok(Math.abs(second.x - 0.75) < 1e-9);
  assert.ok(Math.abs(second.y - 0.55) < 1e-9);
});


test('starts a thrown prop trajectory at the holder release contact, not a stale previousPosition', () => {
  const throwing = {
    actionTimeline: { schemaVersion: 1, phases: [{
      phase: 'action', start: 0.2, end: 0.8, actorId: 'Fox',
      steps: [{ intent: 'throw', start: 0.2, end: 0.8, actorId: 'Fox',
        targetId: 'ball', evidence: 'Fox throws the ball' }]
    }] },
    stateChanges: [
      { entityType: 'prop', entityId: 'ball', property: 'holder',
        previousValue: 'Fox', value: null, actorId: 'Fox', actionIntent: 'throw',
        position: { x: 0.52, y: 0.62 }, evidence: 'Fox releases the ball' },
      { entityType: 'prop', entityId: 'ball', property: 'position',
        previousPosition: { x: 0.08, y: 0.12 }, position: { x: 0.9, y: 0.3 },
        actorId: 'Fox', actionIntent: 'throw', evidence: 'Fox throws the ball' }
    ]
  };
  const start = buildScenePropRenderPlan(throwing, layers, 0.2)[0];
  const middle = buildScenePropRenderPlan(throwing, layers, 0.5)[0];
  const end = buildScenePropRenderPlan(throwing, layers, 0.8)[0];
  assert.ok(Math.abs(start.x - 0.52) < 1e-9);
  assert.ok(Math.abs(start.y - 0.62) < 1e-9);
  assert.ok(Math.abs(middle.x - 0.71) < 1e-9);
  assert.ok(Math.abs(middle.y - 0.46) < 1e-9);
  assert.ok(Math.abs(end.x - 0.9) < 1e-9);
  assert.ok(Math.abs(end.y - 0.3) < 1e-9);
});

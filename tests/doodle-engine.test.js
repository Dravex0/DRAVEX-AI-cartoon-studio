import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIONS, BACKGROUNDS, poseAt, mouthEnvelope, parseStory, sceneDuration, actionForStep,
  drawFigure, drawScene, drawProceduralSceneActors, createProceduralActorLayers, resolveProceduralHandAnchors
} from '../src/doodle-engine.js';

function mockCanvas() {
  const calls = [];
  const gradient = { addColorStop: (...args) => calls.push(['addColorStop', ...args]) };
  const target = {
    canvas: { width: 640, height: 360 },
    createLinearGradient: (...args) => { calls.push(['createLinearGradient', ...args]); return gradient; },
    fillText: (...args) => calls.push(['fillText', ...args])
  };
  const context = new Proxy(target, {
    get(object, property) {
      if (property in object) return object[property];
      return (...args) => calls.push([String(property), ...args]);
    },
    set(object, property, value) { object[property] = value; return true; }
  });
  return { context, calls };
}

test('exports the supported action and background vocabulary', () => {
  for (const action of ['idle', 'walk', 'run', 'jump', 'wave', 'scared', 'talk']) {
    assert.ok(ACTIONS.includes(action), 'legacy action remains supported: ' + action);
  }
  for (const action of ['attack', 'defend', 'dodge', 'throw', 'catch', 'give', 'take', 'put_down', 'point', 'vanish']) {
    assert.ok(ACTIONS.includes(action), 'interaction action is supported: ' + action);
  }
  assert.deepEqual(BACKGROUNDS, ['day', 'night', 'forest', 'city']);
});

test('produces deterministic finite poses for every action', () => {
  for (const action of ACTIONS) {
    const first = poseAt(action, 0.37, 'Foxy');
    const second = poseAt(action, 0.37, 'Foxy');
    assert.deepEqual(first, second);
    for (const value of Object.values(first)) {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), action + ' pose must remain finite');
    }
  }
});

test('walk, run, jump and wave create distinct motion curves', () => {
  const idle = poseAt('idle', 0.25, 'actor');
  const walk = poseAt('walk', 0.25, 'actor');
  const run = poseAt('run', 0.25, 'actor');
  const jump = poseAt('jump', 0.5, 'actor');
  const wave = poseAt('wave', 0.25, 'actor');
  assert.notEqual(walk.leftLeg, idle.leftLeg);
  assert.notEqual(run.leftLeg, walk.leftLeg);
  assert.ok(jump.bob < 0);
  assert.ok(Math.abs(wave.rightArm) < 0.6);
  assert.ok(wave.leftArm > 1.0);
});

test('keeps the legacy mouth envelope bounded and outside-scene silence', () => {
  for (let time = 0; time <= 1000; time += 7) {
    const value = mouthEnvelope(time, 1000);
    assert.ok(value >= 0 && value <= 1);
  }
  assert.equal(mouthEnvelope(-1, 1000), 0);
  assert.equal(mouthEnvelope(1001, 1000), 0);
});

test('parses the compact Doodle scene format and applies safe defaults', () => {
  const scenes = parseStory('Forest intro | forest | walk | Foxy enters the forest\nCity finale | invalid | invalid | The end');
  assert.equal(scenes.length, 2);
  assert.deepEqual(scenes[0], {
    id: 'doodle-1', title: 'Forest intro', background: 'forest',
    action: 'walk', caption: 'Foxy enters the forest', flags: []
  });
  assert.equal(scenes[1].background, 'day');
  assert.equal(scenes[1].action, 'idle');
});

test('clamps scene duration to the supported 3–10 second range', () => {
  assert.equal(sceneDuration(1), 3);
  assert.equal(sceneDuration(5), 5);
  assert.equal(sceneDuration(15), 10);
  assert.equal(sceneDuration('invalid'), 5);
});

test('draws a species-aware figure using Canvas primitives', () => {
  const { context, calls } = mockCanvas();
  assert.equal(drawFigure(context, poseAt('walk', 0.4, 'Foxy'), {
    x: 320, y: 250, size: 220, characterId: 'Foxy',
    profile: { species: 'fox' }, mouthOpenness: 0.4
  }), true);
  assert.ok(calls.some(([name]) => name === 'ellipse'));
  assert.ok(calls.some(([name]) => name === 'stroke'));
  assert.ok(calls.some(([name]) => name === 'fill'));
});

test('draws all standalone backgrounds and a character', () => {
  for (const background of BACKGROUNDS) {
    const { context, calls } = mockCanvas();
    const result = drawScene(context, { background, characterId: 'Foxy', action: 'wave', caption: 'Hello' }, { width: 640, height: 360, progress: 0.5 });
    assert.deepEqual(result, { drawn: 1, skipped: 0 });
    assert.ok(calls.some(([name]) => name === 'fillRect'));
    assert.ok(calls.some(([name]) => name === 'fillText'));
  }
});

test('creates and renders offline actors only when sprite and rig art are absent', () => {
  const scene = {
    characters: ['Foxy', 'Bird'],
    characterLayers: [{ characterId: 'Bird', imageUrl: 'https://example.test/bird.png' }],
    characterRigs: []
  };
  const layers = createProceduralActorLayers(scene, 0.5);
  assert.deepEqual(layers.map(layer => layer.characterId), ['Foxy']);
  const { context } = mockCanvas();
  const result = drawProceduralSceneActors(context, scene, {
    width: 640, height: 360, progress: 0.5, characterBible: [{ characterId: 'Foxy', species: 'fox' }]
  });
  assert.equal(result.drawn, 1);
  assert.equal(result.skipped, 0);
  assert.equal(result.layers.length, 1);
  assert.equal(result.layers[0].procedural, true);
});



test('computes procedural hand anchors from the same pose and facing transform as the drawn actor', () => {
  const layer = { characterId: 'Mira', x: 0.5, y: 0.7, flipX: false };
  const pose = poseAt('give', 0.4, 'Mira');
  const normal = resolveProceduralHandAnchors(layer, pose, 640, 360, 187.2);
  const flipped = resolveProceduralHandAnchors({ ...layer, flipX: true }, pose, 640, 360, 187.2);
  assert.ok(normal && flipped);
  assert.ok(normal.rightHand.x > normal.leftHand.x);
  assert.ok(flipped.rightHand.x < flipped.leftHand.x);
  for (const anchor of Object.values(normal)) {
    assert.ok(Number.isFinite(anchor.x) && Number.isFinite(anchor.y) && Number.isFinite(anchor.rotation));
  }
  assert.notEqual(normal.rightHand.x, flipped.rightHand.x);
});


test('moves procedural hand contacts with the authored walk pose over the action clock', () => {
  const scene = {
    storyDetail: 'Mira walks forward.',
    characters: ['Mira'],
    actionTimeline: { schemaVersion: 1, phases: [{
      phase: 'action', start: 0, end: 1, actorId: 'Mira',
      steps: [{ intent: 'advance', start: 0, end: 1, actorId: 'Mira',
        description: 'Mira walks forward', evidence: 'Mira walks forward.' }]
    }] }
  };
  const early = drawProceduralSceneActors(mockCanvas().context, scene, {
    width: 640, height: 360, progress: 0.1
  }).propAnchors.Mira;
  const late = drawProceduralSceneActors(mockCanvas().context, scene, {
    width: 640, height: 360, progress: 0.7
  }).propAnchors.Mira;
  assert.notEqual(early.rightHand.x, late.rightHand.x);
  assert.notEqual(early.rightHand.y, late.rightHand.y);
});

test('returns procedural hand anchors alongside rendered actors for prop attachment', () => {
  const scene = {
    storyDetail: 'Mira picks up the key.',
    characters: ['Mira'],
    actionTimeline: { schemaVersion: 1, phases: [{
      phase: 'action', start: 0, end: 1, actorId: 'Mira',
      steps: [{ intent: 'pick_up', start: 0, end: 1, actorId: 'Mira',
        targetId: 'key', description: 'Mira picks up the key', evidence: 'Mira picks up the key.' }]
    }] }
  };
  const { context } = mockCanvas();
  const result = drawProceduralSceneActors(context, scene, { width: 640, height: 360, progress: 0.5 });
  assert.equal(result.drawn, 1);
  assert.ok(result.propAnchors.Mira.rightHand);
  assert.ok(result.propAnchors.Mira.leftHand);
});

test('maps semantic interaction intents to explicit Doodle acting poses', () => {
  assert.equal(actionForStep({ intent: 'attack', motionCue: 'run' }), 'attack');
  assert.equal(actionForStep({ intent: 'defend', motionCue: 'turn' }), 'defend');
  assert.equal(actionForStep({ intent: 'throw', motionCue: 'run' }), 'throw');
  assert.equal(actionForStep({ intent: 'catch', motionCue: 'turn' }), 'catch');
  assert.equal(actionForStep({ intent: 'give', motionCue: 'talk' }), 'give');
  assert.equal(actionForStep({ intent: 'point', motionCue: 'turn' }), 'point');
  assert.equal(actionForStep({ intent: 'pick_up', motionCue: 'turn' }), 'take');
  assert.equal(actionForStep({ intent: 'drop_weapon', motionCue: 'turn' }), 'put_down');
  assert.equal(actionForStep({ intent: 'take_cover', motionCue: 'jump' }), 'defend');
  assert.equal(actionForStep({ intent: 'aim_weapon', motionCue: 'turn' }), 'point');
  assert.equal(actionForStep({ intent: 'draw_weapon', motionCue: 'turn' }), 'take');
  assert.equal(actionForStep({ intent: 'hug', motionCue: 'happy' }), 'happy');
  assert.equal(actionForStep({ intent: 'swim', motionCue: 'float' }), 'float');
  assert.equal(actionForStep({ intent: 'unrecognized', motionCue: 'wave' }), 'wave');
});


test('maps common object interaction synonyms and rejects inherited object keys', () => {
  for (const intent of ['pickup', 'grab', 'grasp', 'hold']) {
    assert.equal(actionForStep({ intent }), 'take', intent);
  }
  for (const intent of ['drop', 'release', 'place', 'set_down']) {
    assert.equal(actionForStep({ intent }), 'put_down', intent);
  }
  for (const intent of ['handoff', 'hand_off', 'pass']) {
    assert.equal(actionForStep({ intent }), 'give', intent);
  }
  for (const intent of ['receive', 'accept']) {
    assert.equal(actionForStep({ intent }), 'catch', intent);
  }
  assert.equal(actionForStep({ intent: 'carry' }), 'walk');
  assert.notEqual(typeof actionForStep({ intent: 'constructor' }), 'function');
  assert.notEqual(typeof actionForStep({ intent: 'toString' }), 'function');
});

test('uses the offline actor while an authored sprite is not decoded, then yields to the real image', () => {
  const scene = {
    characters: ['Foxy'],
    characterLayers: [{ characterId: 'Foxy', imageUrl: 'https://example.test/fox.png', visible: true }]
  };
  assert.deepEqual(createProceduralActorLayers(scene).map(layer => layer.characterId), []);
  assert.deepEqual(createProceduralActorLayers(scene, 0, {
    resolveImage: () => ({ naturalWidth: 0 })
  }).map(layer => layer.characterId), ['Foxy']);
  assert.deepEqual(createProceduralActorLayers(scene, 0, {
    resolveImage: () => ({ naturalWidth: 256 })
  }).map(layer => layer.characterId), []);
});

test('uses the resolved protagonist when a scene has no explicit cast list', () => {
  const { context } = mockCanvas();
  const result = drawProceduralSceneActors(context, {}, {
    protagonistId: 'Foxy', width: 640, height: 360, progress: 0.5
  });
  assert.equal(result.drawn, 1);
  assert.equal(result.layers[0].characterId, 'Foxy');
});


test('moves a procedural actor toward a named character using the validated motion planner', () => {
  const scene = {
    id: 'doodle-approach',
    characters: ['Mira', 'Noah'],
    storyDetail: 'Mira walks toward Noah.',
    actionTimeline: {
      schemaVersion: 1,
      phases: [{
        phase: 'action', start: 0, end: 1, actorId: 'Mira',
        description: 'Mira walks toward Noah.',
        evidence: 'Mira walks toward Noah.',
        steps: [{
          intent: 'walk', motionCue: 'walk', start: 0, end: 1,
          actorId: 'Mira', targetId: 'Noah',
          description: 'Mira walks toward Noah.',
          evidence: 'Mira walks toward Noah.'
        }]
      }]
    }
  };
  const start = createProceduralActorLayers(scene, 0);
  const middle = createProceduralActorLayers(scene, 0.5);
  assert.equal(start[0].x, 0.28);
  assert.ok(middle[0].x > start[0].x);
  assert.equal(middle[1].x, 0.72);
});


test('combines authored layer opacity with pose opacity instead of overriding a fade', () => {
  const { context } = mockCanvas();
  context.globalAlpha = 0.8;
  assert.equal(drawFigure(context, { action: 'vanish', opacity: 0.25 }, {
    x: 320, y: 250, size: 220, characterId: 'Foxy', opacity: 0.5
  }), true);
  assert.equal(context.globalAlpha, 0.1);
});


test('mirrors the procedural figure toward a named target on its left', () => {
  const { context, calls } = mockCanvas();
  assert.equal(drawFigure(context, poseAt('attack', 0.5, 'Noah'), {
    x: 460, y: 250, size: 220, characterId: 'Noah', flipX: true
  }), true);
  assert.ok(calls.some(([name, x, y]) => name === 'scale' && x === -1 && y === 1));
});

test('turns an acting procedural character toward its named target', () => {
  const scene = {
    characters: ['Mira', 'Noah'],
    storyDetail: 'Noah attacks Mira.',
    actionTimeline: {
      schemaVersion: 1,
      phases: [{
        phase: 'action', start: 0, end: 1, actorId: 'Noah',
        description: 'Noah attacks Mira.',
        evidence: 'Noah attacks Mira.',
        steps: [{
          intent: 'attack', motionCue: 'run', start: 0, end: 1,
          actorId: 'Noah', targetId: 'Mira',
          description: 'Noah attacks Mira.',
          evidence: 'Noah attacks Mira.'
        }]
      }]
    }
  };
  const { context } = mockCanvas();
  const result = drawProceduralSceneActors(context, scene, {
    width: 640, height: 360, progress: 0.5
  });
  const noah = result.layers.find(layer => layer.characterId === 'Noah');
  assert.ok(noah);
  assert.equal(noah.flipX, true);
});


test('keeps procedural actors visible when matching sprite layers are hidden or fully transparent', () => {
  const hiddenScene = {
    characters: ['Foxy'],
    characterLayers: [{
      characterId: 'Foxy',
      imageUrl: 'https://example.test/hidden-fox.png',
      visible: false,
      opacity: 1
    }]
  };
  const transparentScene = {
    characters: ['Foxy'],
    characterLayers: [{
      characterId: 'Foxy',
      imageUrl: 'https://example.test/transparent-fox.png',
      visible: true,
      opacity: 0
    }]
  };
  assert.deepEqual(createProceduralActorLayers(hiddenScene).map(layer => layer.characterId), ['Foxy']);
  assert.deepEqual(createProceduralActorLayers(transparentScene).map(layer => layer.characterId), ['Foxy']);
});

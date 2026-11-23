import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIONS, BACKGROUNDS, poseAt, mouthEnvelope, parseStory, sceneDuration,
  drawFigure, drawScene, drawProceduralSceneActors, createProceduralActorLayers
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
  assert.deepEqual(ACTIONS, ['idle', 'walk', 'run', 'jump', 'wave', 'scared', 'talk', 'happy', 'sad', 'turn', 'dance', 'float']);
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
  assert.ok(Math.abs(wave.rightArm) < 0.6);\n  assert.ok(wave.leftArm > 1.0);
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

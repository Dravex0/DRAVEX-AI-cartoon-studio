import test from 'node:test';
import assert from 'node:assert/strict';
import { drawProceduralDemoFox } from '../src/demo-character-renderer.js';

function recordingContext() {
  const calls = [];
  const noop = () => {};
  const ctx = new Proxy({ calls }, {
    get(target, key) {
      if (key === 'calls') return calls;
      if (key in target) return target[key];
      return (...args) => calls.push([key, ...args]);
    },
    set(target, key, value) { target[key] = value; return true; }
  });
  return ctx;
}

test('draws an articulated procedural fox with limbs, ears, tail and face', () => {
  const ctx = recordingContext();
  const result = drawProceduralDemoFox(ctx, { x: 120, y: 180, time: 0.4, action: 'walk' });
  assert.ok(Number.isFinite(result.x) && Number.isFinite(result.y));
  const ellipseCalls = ctx.calls.filter(call => call[0] === 'ellipse');
  const pathCalls = ctx.calls.filter(call => call[0] === 'quadraticCurveTo');
  assert.ok(ellipseCalls.length >= 8, 'body, paws and facial features should be drawn');
  assert.ok(pathCalls.length >= 2, 'tail should use a curved shape');
  assert.ok(ctx.calls.some(call => call[0] === 'rotate'), 'independent limbs should rotate');
});

test('walk and wave produce distinct limb motion', () => {
  const walk = recordingContext();
  const wave = recordingContext();
  drawProceduralDemoFox(walk, { time: 0.7, action: 'walk' });
  drawProceduralDemoFox(wave, { time: 0.7, action: 'wave' });
  const walkRotations = walk.calls.filter(call => call[0] === 'rotate').map(call => call[1]);
  const waveRotations = wave.calls.filter(call => call[0] === 'rotate').map(call => call[1]);
  assert.notDeepEqual(walkRotations, waveRotations);
});

test('rejects an invalid drawing context', () => {
  assert.throws(() => drawProceduralDemoFox(null), /CanvasRenderingContext2D-like/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { drawProceduralCharacterStandIn } from '../src/procedural-character-stand-in.js';

function contextStub() {
  const calls = [];
  const context = new Proxy({}, {
    get(target, property) {
      if (property === 'calls') return calls;
      if (property === 'save' || property === 'restore' || property === 'beginPath'
        || property === 'closePath' || property === 'fill' || property === 'stroke') {
        return (...args) => calls.push([property, ...args]);
      }
      if (property === 'moveTo' || property === 'lineTo' || property === 'arc'
        || property === 'ellipse' || property === 'quadraticCurveTo'
        || property === 'roundRect' || property === 'fillRect' || property === 'fillText'
        || property === 'translate' || property === 'scale' || property === 'rotate') {
        return (...args) => calls.push([property, ...args]);
      }
      return target[property];
    },
    set(target, property, value) { target[property] = value; return true; }
  });
  return context;
}

test('draws a named local stand-in with an explicit procedural badge', () => {
  const context = contextStub();
  const result = drawProceduralCharacterStandIn(context, {
    characterId: 'Kel',
    profile: { visualDescription: 'young forest adventurer wearing a dark green cloak' },
    width: 1280,
    height: 720,
    time: 1.2
  });
  assert.equal(result.drawn, true);
  assert.equal(result.mode, 'procedural-stand-in');
  assert.equal(result.characterId, 'Kel');
  assert.ok(context.calls.some(call => call[0] === 'fillText' && call[1] === 'LOCAL STAND-IN'));
  assert.ok(context.calls.some(call => call[0] === 'quadraticCurveTo'));
});

test('extends the active arm to the source-locked prop target during a rescue action', () => {
  const context = contextStub();
  const result = drawProceduralCharacterStandIn(context, {
    characterId: 'Kel',
    x: 0.4,
    y: 0.78,
    width: 1280,
    height: 720,
    progress: 1,
    action: 'lift',
    target: { x: 0.52, y: 0.7 },
    held: true
  });
  assert.equal(result.drawn, true);
  assert.ok(result.handTarget.x > 0.5);
  assert.ok(result.handTarget.y < 0.75);
});

test('does not report a drawn character when canvas dimensions are invalid', () => {
  const context = contextStub();
  assert.deepEqual(drawProceduralCharacterStandIn(context, { width: 0, height: 720 }), {
    drawn: false,
    reason: 'invalid-canvas'
  });
  assert.equal(context.calls.length, 0);
});

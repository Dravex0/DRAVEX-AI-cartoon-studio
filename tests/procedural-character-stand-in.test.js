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
    held: false
  });
  assert.equal(result.drawn, true);
  assert.ok(result.handTarget.x > 0.5);
  assert.ok(result.handTarget.y < 0.75);
  assert.ok(Math.abs(result.drawnHand.x - 0.52) < 0.001);
  assert.ok(Math.abs(result.drawnHand.y - 0.7) < 0.001);
});

test('does not report a drawn character when canvas dimensions are invalid', () => {
  const context = contextStub();
  assert.deepEqual(drawProceduralCharacterStandIn(context, { width: 0, height: 720 }), {
    drawn: false,
    reason: 'invalid-canvas'
  });
  assert.equal(context.calls.length, 0);
});


test('keeps one hand on a carried prop while the other reaches for a second target', () => {
  const context = contextStub();
  const result = drawProceduralCharacterStandIn(context, {
    characterId: 'Kel',
    x: 0.4,
    y: 0.75,
    width: 1280,
    height: 720,
    progress: 1,
    action: 'free',
    held: true,
    heldTarget: { x: 0.52, y: 0.67 },
    target: { x: 0.54, y: 0.755 }
  });
  assert.ok(Math.abs(result.drawnHand.x - 0.52) < 0.001);
  assert.ok(Math.abs(result.drawnHand.y - 0.67) < 0.001);
  assert.ok(Math.abs(result.secondaryHand.x - 0.54) < 0.001);
  assert.ok(Math.abs(result.secondaryHand.y - 0.755) < 0.001);
});


test('animates a raised waving hand and keeps the character render mode procedural', () => {
  const context = contextStub();
  const idle = drawProceduralCharacterStandIn(contextStub(), {
    characterId: 'Kel', width: 1280, height: 720, x: 0.4, y: 0.75, time: 0.7, action: 'idle'
  });
  const waving = drawProceduralCharacterStandIn(context, {
    characterId: 'Kel', width: 1280, height: 720, x: 0.4, y: 0.75, time: 0.7, action: 'wave'
  });
  assert.equal(waving.mode, 'procedural-stand-in');
  assert.ok(waving.drawnHand.y < idle.drawnHand.y - 0.06);
});

test('supports jump and speech cues without inventing an asset-backed character', () => {
  const jumpContext = contextStub();
  const jump = drawProceduralCharacterStandIn(jumpContext, {
    characterId: 'Kel', width: 1280, height: 720, x: 0.4, y: 0.75, time: 0.5, action: 'jump'
  });
  const talkContext = contextStub();
  const talk = drawProceduralCharacterStandIn(talkContext, {
    characterId: 'Kel', width: 1280, height: 720, x: 0.4, y: 0.75, time: 0.5, action: 'talk'
  });
  assert.equal(jump.drawn, true);
  assert.equal(talk.drawn, true);
  assert.ok(jumpContext.calls.some(call => call[0] === 'translate'));
  assert.ok(talkContext.calls.some(call => call[0] === 'ellipse'));
});

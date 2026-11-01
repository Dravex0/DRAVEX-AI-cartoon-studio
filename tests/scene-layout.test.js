import test from 'node:test';
import assert from 'node:assert/strict';
import { getSceneComposition } from '../src/scene-layout.js';

test('preserves normalized landscape anchors for existing storyboard scenes', () => {
  const layout = getSceneComposition('landscape', 0);
  assert.equal(layout.width, 640);
  assert.equal(layout.height, 360);
  assert.deepEqual(layout.star, { x: 440 / 640, y: 190 / 360 });
  assert.deepEqual(layout.character, { x: 225 / 640, y: 290 / 360, scale: 1 });
});

test('places portrait scene elements within a tall composition', () => {
  const layout = getSceneComposition('portrait', 0);
  assert.equal(layout.width, 360);
  assert.equal(layout.height, 640);
  assert.equal(layout.star.x, 0.5);
  assert.equal(layout.character.x, 0.5);
  assert.ok(layout.star.y < layout.character.y);
  assert.ok(layout.character.y > 0.7);
  assert.equal(layout.character.scale, 0.78);
  assert.ok(layout.ground.centerY > 0.8);
});

test('supports the 9:16 alias and safely normalizes scene indices', () => {
  assert.deepEqual(getSceneComposition('9:16', -4), getSceneComposition('portrait', 0));
  assert.equal(getSceneComposition('unknown', 1).format, 'landscape');
});

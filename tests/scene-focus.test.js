import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveSceneFocus } from '../src/scene-focus.js';

const appSource = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

test('keeps the procedural protagonist and focal prop inside the same extreme-close-up frame', () => {
  const width = 1280, height = 720, zoom = 2.1;
  const focus = resolveSceneFocus({
    fallbackCharacterVisible: true,
    actorPoint: { x: 225, y: 290 },
    propPoint: { x: 440, y: 190 },
    focusTarget: 'prop',
    viewportWidth: width,
    viewportHeight: height,
    requestedOffsetY: 75
  });

  assert.deepEqual(focus, { x: 332.5, y: 240, offsetY: 0 });
  const toScreen = point => ({
    x: width / 2 + (point.x - focus.x) * zoom,
    y: height / 2 + focus.offsetY + (point.y - focus.y) * zoom
  });
  const actor = toScreen({ x: 225, y: 290 });
  const prop = toScreen({ x: 440, y: 190 });
  const actorHalfWidth = 55 * zoom;
  const actorHalfHeight = 89 * zoom;
  const propRadius = 30 * zoom;

  assert.ok(actor.x - actorHalfWidth >= 0 && actor.x + actorHalfWidth <= width,
    'the full fallback protagonist must remain horizontally visible');
  assert.ok(actor.y - actorHalfHeight >= 0 && actor.y + actorHalfHeight <= height,
    'the fallback protagonist must remain vertically visible');
  assert.ok(prop.x - propRadius >= 0 && prop.x + propRadius <= width,
    'the focal prop must remain horizontally visible');
  assert.ok(prop.y - propRadius >= 0 && prop.y + propRadius <= height,
    'the focal prop must remain vertically visible');
});

test('keeps actor-focused camera offsets when the shot does not target a prop', () => {
  assert.deepEqual(resolveSceneFocus({
    fallbackCharacterVisible: true,
    actorPoint: { x: 225, y: 290 },
    propPoint: { x: 440, y: 190 },
    focusTarget: 'actor_face',
    viewportWidth: 1280,
    viewportHeight: 720,
    requestedOffsetY: 55
  }), { x: 225, y: 290, offsetY: 55 });
});

test('does not move the camera toward a fallback actor when no fallback is visible', () => {
  assert.deepEqual(resolveSceneFocus({
    fallbackCharacterVisible: false,
    actorPoint: { x: 225, y: 290 },
    propPoint: { x: 440, y: 190 },
    focusTarget: 'prop',
    viewportWidth: 1280,
    viewportHeight: 720,
    requestedOffsetY: 75
  }), { x: 640, y: 468, offsetY: 75 });
});

test('falls back to the actor anchor when a prop focus point is invalid', () => {
  assert.deepEqual(resolveSceneFocus({
    fallbackCharacterVisible: true,
    actorPoint: { x: 225, y: 290 },
    propPoint: { x: Number.NaN, y: 190 },
    focusTarget: 'prop',
    viewportWidth: 1280,
    viewportHeight: 720
  }), { x: 225, y: 290, offsetY: 0 });
});

test('the shared preview and export draw path applies the resolved focus and offset', () => {
  assert.match(appSource, /import \{ resolveSceneFocus \} from ['"]\.\/scene-focus\.js['"]/);
  assert.match(appSource, /const sceneFocus=resolveSceneFocus\(/);
  assert.match(appSource, /const renderCameraPlan=\{\.\.\.cameraPlan,offsetY:sceneFocus\.offsetY\}/);
  assert.match(appSource, /ctx\.translate\(w\/2,h\/2\+renderCameraPlan\.offsetY\)/);
  assert.match(appSource, /camera:\s*renderCameraPlan,\s*focusX,\s*focusY/);
  assert.match(appSource, /cameraPlan:renderCameraPlan,focusX,focusY/);
});

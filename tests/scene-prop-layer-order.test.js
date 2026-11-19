import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('draws character layers before hand-anchored props in the shared preview and export compositor', () => {
  const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const frameStart = source.indexOf('const sampledRigPoses');
  assert.notEqual(frameStart, -1, 'shared scene compositor should sample the scene rig timeline');
  const characterDraw = source.indexOf('drawCharacterLayers(', frameStart);
  const propDraw = source.indexOf('drawSceneProps(', frameStart);
  assert.notEqual(characterDraw, -1, 'character layers should be drawn');
  assert.notEqual(propDraw, -1, 'explicit scene props should be drawn');
  assert.ok(characterDraw < propDraw,
    'held objects should render after character layers so the body does not hide the hand-held prop');
});

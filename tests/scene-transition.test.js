import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SCENE_TRANSITION_FRAMES, getSceneTransitionProgress } from '../src/scene-transition.js';

test('crossfade progresses from old scene to new scene over the configured frames', () => {
  assert.equal(getSceneTransitionProgress(100, 100), 0);
  assert.equal(getSceneTransitionProgress(100, 106), 0.5);
  assert.equal(getSceneTransitionProgress(100, 112), 1);
  assert.equal(DEFAULT_SCENE_TRANSITION_FRAMES, 12);
});

test('crossfade progress is clamped and handles invalid timing safely', () => {
  assert.equal(getSceneTransitionProgress(100, 90), 0);
  assert.equal(getSceneTransitionProgress(100, 500), 1);
  assert.equal(getSceneTransitionProgress(Number.NaN, 100), 1);
  assert.equal(getSceneTransitionProgress(10, Number.NaN), 0);
  assert.equal(getSceneTransitionProgress(10, 15, 0), 5 / 12);
});

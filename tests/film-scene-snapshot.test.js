import test from 'node:test';
import assert from 'node:assert/strict';
import { captureFilmSceneSnapshot, matchesFilmSceneSnapshot } from '../src/film-scene-snapshot.js';

const videoA = { readyState: 4 };
const videoB = { readyState: 4 };
const scenes = [{ id: 'a', title: 'Opening' }, { id: 'b', title: 'Ending' }];
const cache = new Map([['a', videoA], ['b', videoB]]);
const getVideo = scene => cache.get(scene.id);
const decoded = video => video?.readyState >= 2;

test('accepts the exact same ordered scene and decoded video elements', () => {
  const snapshot = captureFilmSceneSnapshot(scenes, getVideo);
  assert.equal(matchesFilmSceneSnapshot(snapshot, scenes, getVideo, decoded), true);
});

test('rejects a scene reorder even when all videos remain decoded', () => {
  const snapshot = captureFilmSceneSnapshot(scenes, getVideo);
  assert.equal(matchesFilmSceneSnapshot(snapshot, [...scenes].reverse(), getVideo, decoded), false);
});

test('rejects a replaced video element under the same stable scene ID', () => {
  const snapshot = captureFilmSceneSnapshot(scenes, getVideo);
  cache.set('b', { readyState: 4 });
  assert.equal(matchesFilmSceneSnapshot(snapshot, scenes, getVideo, decoded), false);
});

test('rejects removed, undecoded, renamed or replaced scenes', () => {
  const snapshot = captureFilmSceneSnapshot(scenes, getVideo);
  assert.equal(matchesFilmSceneSnapshot(snapshot, scenes.slice(0, 1), getVideo, decoded), false);
  assert.equal(matchesFilmSceneSnapshot(snapshot, [{ ...scenes[0], title: 'Edited' }, scenes[1]], getVideo, decoded), false);
  assert.equal(matchesFilmSceneSnapshot(snapshot, scenes, () => ({ readyState: 1 }), decoded), false);
  assert.equal(matchesFilmSceneSnapshot(snapshot, scenes, () => null, decoded), false);
});

test('validates snapshot inputs', () => {
  assert.throws(() => captureFilmSceneSnapshot(null, getVideo), /array/);
  assert.throws(() => captureFilmSceneSnapshot([], null), /function/);
  assert.equal(matchesFilmSceneSnapshot(null, scenes, getVideo, decoded), false);
});

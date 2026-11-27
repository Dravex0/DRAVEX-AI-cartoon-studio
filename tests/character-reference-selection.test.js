import test from 'node:test';
import assert from 'node:assert/strict';
import { prioritizeCharacterReferenceImages } from '../src/character-reference-selection.js';

const image = name => ({ name, blob: new Blob([name], { type: 'image/png' }) });

test('prioritizes explicitly selected local images before Character Bible references', () => {
  const manual = [image('manual-fox.png'), image('manual-pose.png')];
  const saved = [image('Foxy.png'), image('Mira.png')];

  const result = prioritizeCharacterReferenceImages(manual, saved, { manualSceneId: 'scene-a', sceneId: 'scene-a' });

  assert.deepEqual(result.map(item => item.name), [
    'manual-fox.png',
    'manual-pose.png',
    'Foxy.png',
    'Mira.png'
  ]);
  assert.equal(result[0].blob, manual[0].blob);
  assert.equal(result[2].blob, saved[0].blob);
});

test('preserves all valid references so the provider can report overflow', () => {
  const manual = [image('manual-1.png'), image('manual-2.png'), image('manual-3.png')];
  const saved = [image('saved-1.png'), image('saved-2.png'), image('saved-3.png')];

  const result = prioritizeCharacterReferenceImages(manual, saved, { manualSceneId: 'scene-a', sceneId: 'scene-a' });

  assert.equal(result.length, 6);
  assert.deepEqual(result.slice(0, 3).map(item => item.name), manual.map(item => item.name));
  assert.deepEqual(result.slice(3).map(item => item.name), saved.map(item => item.name));
});

test('filters missing and empty image blobs without disturbing valid reference order', () => {
  const manual = [null, { name: 'empty.png', blob: new Blob([]) }, image('manual.png')];
  const saved = [{ name: 'missing.png' }, image('saved.png')];

  const result = prioritizeCharacterReferenceImages(manual, saved, { manualSceneId: 'scene-a', sceneId: 'scene-a' });

  assert.deepEqual(result.map(item => item.name), ['manual.png', 'saved.png']);
});


test('manual references are excluded from every scene except the scene where they were selected', () => {
  const manual = [image('manual-scene-a.png')];
  const saved = [image('character-bible-scene-b.png')];

  const result = prioritizeCharacterReferenceImages(manual, saved, {
    manualSceneId: 'scene-a',
    sceneId: 'scene-b'
  });

  assert.deepEqual(result.map(item => item.name), ['character-bible-scene-b.png']);
  assert.equal(result[0].blob, saved[0].blob);
});

test('manual references are never treated as film-wide references without a matching scene identity', () => {
  const manual = [image('manual.png')];
  const saved = [image('saved.png')];

  assert.deepEqual(
    prioritizeCharacterReferenceImages(manual, saved).map(item => item.name),
    ['saved.png']
  );
  assert.deepEqual(
    prioritizeCharacterReferenceImages(manual, saved, { manualSceneId: 'scene-a', sceneId: 'scene-a' }).map(item => item.name),
    ['manual.png', 'saved.png']
  );
});


test('preserves the numbered slot of manually selected reference files', () => {
  const manual = [];
  manual[2] = image('manual-reference-3.png');
  const saved = [image('character-bible-reference.png')];

  const result = prioritizeCharacterReferenceImages(manual, saved, {
    manualSceneId: 'scene-a',
    sceneId: 'scene-a'
  });

  assert.equal(result[0].name, 'manual-reference-3.png');
  assert.equal(result[0].slot, 3);
  assert.equal(result[1].name, 'character-bible-reference.png');
  assert.equal(Object.hasOwn(result[1], 'slot'), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { prioritizeCharacterReferenceImages } from '../src/character-reference-selection.js';

const image = name => ({ name, blob: new Blob([name], { type: 'image/png' }) });

test('prioritizes explicitly selected local images before Character Bible references', () => {
  const manual = [image('manual-fox.png'), image('manual-pose.png')];
  const saved = [image('Foxy.png'), image('Mira.png')];

  const result = prioritizeCharacterReferenceImages(manual, saved);

  assert.deepEqual(result.map(item => item.name), [
    'manual-fox.png',
    'manual-pose.png',
    'Foxy.png',
    'Mira.png'
  ]);
  assert.equal(result[0].blob, manual[0].blob);
  assert.equal(result[2].blob, saved[0].blob);
});

test('does not silently truncate references beyond two or four slots', () => {
  const manual = [image('manual-1.png'), image('manual-2.png'), image('manual-3.png')];
  const saved = [image('saved-1.png'), image('saved-2.png'), image('saved-3.png')];

  const result = prioritizeCharacterReferenceImages(manual, saved);

  assert.equal(result.length, 6);
  assert.deepEqual(result.slice(0, 3).map(item => item.name), manual.map(item => item.name));
  assert.deepEqual(result.slice(3).map(item => item.name), saved.map(item => item.name));
});

test('filters missing and empty image blobs without disturbing valid reference order', () => {
  const manual = [null, { name: 'empty.png', blob: new Blob([]) }, image('manual.png')];
  const saved = [{ name: 'missing.png' }, image('saved.png')];

  const result = prioritizeCharacterReferenceImages(manual, saved);

  assert.deepEqual(result.map(item => item.name), ['manual.png', 'saved.png']);
});

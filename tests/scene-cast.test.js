import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSceneCast } from '../src/scene-cast.js';

test('parses a comma-separated cast and removes case-insensitive duplicates', () => {
  assert.deepEqual(normalizeSceneCast('Foxy, Bird, foxY, Robot'), ['Foxy', 'Bird', 'Robot']);
});

test('accepts an array and trims names and whitespace', () => {
  assert.deepEqual(normalizeSceneCast([' Foxy ', '', 'Blue Bird']), ['Foxy', 'Blue Bird']);
});

test('uses the existing cast when the editor field is empty', () => {
  assert.deepEqual(normalizeSceneCast('  ', ['Foxy', 'Bird']), ['Foxy', 'Bird']);
});

test('limits the cast to twelve unique characters and bounds each ID', () => {
  const names = Array.from({ length: 15 }, (_, index) => 'Character ' + index);
  const result = normalizeSceneCast(names);
  assert.equal(result.length, 12);
  assert.ok(result.every(name => name.length <= 120));
});

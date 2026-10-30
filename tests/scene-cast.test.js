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

test('returns an empty cast when both input and fallback are empty', () => {
  assert.deepEqual(normalizeSceneCast('  '), []);
  assert.deepEqual(normalizeSceneCast([], []), []);
});

test('returns an empty cast for a non-array fallback instead of recursing', () => {
  assert.deepEqual(normalizeSceneCast('', 'Foxy'), []);
});

test('normalizes fallback values with the same case-insensitive deduplication and limit', () => {
  assert.deepEqual(normalizeSceneCast('', ['Foxy', 'foxy', 'Bird']), ['Foxy', 'Bird']);
});

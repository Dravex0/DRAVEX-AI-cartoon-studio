import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleDialogueMouthOpen } from '../src/dialogue-lip-sync.js';

function fakeBuffer(samples, sampleRate = 1000) {
  return { length: samples.length, sampleRate, numberOfChannels: 1, getChannelData: () => Float32Array.from(samples) };
}

test('returns closed mouth for silence and invalid input', () => {
  assert.equal(sampleDialogueMouthOpen(fakeBuffer(new Array(100).fill(0)), 30), 0);
  assert.equal(sampleDialogueMouthOpen(null, 30), 0);
  assert.equal(sampleDialogueMouthOpen(fakeBuffer([0.5]), -1), 0);
});

test('mouth opens proportionally when voice amplitude rises', () => {
  const quiet = sampleDialogueMouthOpen(fakeBuffer(new Array(100).fill(0.03)), 40);
  const loud = sampleDialogueMouthOpen(fakeBuffer(new Array(100).fill(0.2)), 40);
  assert.ok(quiet > 0);
  assert.ok(loud > quiet);
  assert.ok(loud <= 1);
});

test('supports stereo buffers and clamps offsets to the end', () => {
  const data = Float32Array.from(new Array(100).fill(0.1));
  const stereo = { length: 100, sampleRate: 1000, numberOfChannels: 2, getChannelData: () => data };
  assert.ok(sampleDialogueMouthOpen(stereo, 1000) > 0);
});

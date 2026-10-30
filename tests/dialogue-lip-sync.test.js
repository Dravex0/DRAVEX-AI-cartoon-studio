import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleDialogueMouthOpen, createDialogueMouthEnvelope, sampleDialogueMouthEnvelope } from '../src/dialogue-lip-sync.js';

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

test('precomputes a smoothed mouth envelope and samples it at cue offsets', () => {
  const samples = [...new Array(80).fill(0), ...new Array(80).fill(0.2), ...new Array(80).fill(0)];
  const envelope = createDialogueMouthEnvelope(fakeBuffer(samples), { windowMs: 16, hopMs: 16 });
  assert.ok(envelope);
  assert.ok(sampleDialogueMouthEnvelope(envelope, 100) > 0);
  assert.ok(sampleDialogueMouthEnvelope(envelope, 220) >= 0);
  assert.equal(sampleDialogueMouthEnvelope(envelope, -1), 0);
  assert.equal(sampleDialogueMouthEnvelope(null, 10), 0);
});

test('envelope stays closed for silence and clamps loud audio', () => {
  const silence = createDialogueMouthEnvelope(fakeBuffer(new Array(100).fill(0)));
  assert.equal(sampleDialogueMouthEnvelope(silence, 40), 0);
  const loud = createDialogueMouthEnvelope(fakeBuffer(new Array(100).fill(1)));
  assert.ok(sampleDialogueMouthEnvelope(loud, 40) <= 1);
});

test('rolling envelope matches reference RMS when hop windows do not overlap', () => {
  const samples = Float32Array.from({ length: 70 }, (_, index) =>
    index < 8 ? 0.04 : index < 24 ? 0.18 : index < 40 ? 0.07 : index < 56 ? 0.25 : 0.02
  );
  const buffer = fakeBuffer(samples, 1000);
  const options = { windowMs: 8, hopMs: 16, noiseFloor: 0.012, sensitivity: 5.5, attack: 0.62, release: 0.28 };
  const envelope = createDialogueMouthEnvelope(buffer, options);
  let previous = 0;
  const expected = [];
  const hopSamples = 16;
  const halfWindow = 4;
  for (let frame = 0; frame < Math.ceil(samples.length / hopSamples); frame++) {
    const center = frame * hopSamples;
    const start = Math.max(0, center - halfWindow);
    const end = Math.min(samples.length, center + halfWindow + 1);
    let sumSquares = 0;
    for (let index = start; index < end; index++) sumSquares += samples[index] * samples[index];
    const rms = end > start ? Math.sqrt(sumSquares / (end - start)) : 0;
    const target = Math.max(0, Math.min(1, (rms - options.noiseFloor) * options.sensitivity));
    previous += (target - previous) * (target > previous ? options.attack : options.release);
    expected.push(previous);
  }
  assert.equal(envelope.values.length, expected.length);
  expected.forEach((value, index) => {
    assert.ok(Math.abs(envelope.values[index] - value) < 1e-6, `frame ${index}: expected ${value}, got ${envelope.values[index]}`);
  });
});

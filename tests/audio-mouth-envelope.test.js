import test from "node:test";
import assert from "node:assert/strict";
import { buildAudioMouthEnvelope, sampleAudioMouthEnvelope } from "../src/audio-mouth-envelope.js";

function tone(sampleRate, durationMs, amplitude, fromMs = 0, toMs = durationMs) {
  const samples = new Float32Array(Math.round(sampleRate * durationMs / 1000));
  const start = Math.floor(sampleRate * fromMs / 1000);
  const end = Math.floor(sampleRate * toMs / 1000);
  for (let i = start; i < end; i++) samples[i] = Math.sin(2 * Math.PI * 220 * i / sampleRate) * amplitude;
  return samples;
}

test("silence keeps the mouth closed for the full dialogue duration", () => {
  const envelope = buildAudioMouthEnvelope({ channels: [new Float32Array(24_000)], sampleRate: 24_000 });
  assert.equal(envelope.frameCount, 24);
  assert.ok(envelope.frames.every(value => value === 0));
  assert.equal(sampleAudioMouthEnvelope(envelope, 250), 0);
});

test("speech energy opens the mouth and silence releases it smoothly", () => {
  const samples = tone(24_000, 1000, 0.5, 100, 600);
  const envelope = buildAudioMouthEnvelope({ channels: [samples], sampleRate: 24_000 });
  assert.ok(envelope.frames[5] > 0.5, "mouth should open during the voiced section");
  assert.ok(envelope.frames[15] > 0.8, "mouth should reach a clearly open pose");
  assert.ok(envelope.frames[22] < envelope.frames[15], "mouth should close after speech energy ends");
  assert.equal(sampleAudioMouthEnvelope(envelope, 1000), 0);
});

test("stereo channels are combined into one stable envelope", () => {
  const left = tone(24_000, 500, 0.2);
  const right = tone(24_000, 500, 0.2);
  const mono = buildAudioMouthEnvelope({ channels: [left], sampleRate: 24_000 });
  const stereo = buildAudioMouthEnvelope({ channels: [left, right], sampleRate: 24_000 });
  assert.deepEqual(stereo.frames, mono.frames);
});

test("time sampling interpolates adjacent frames and clamps outside the cue", () => {
  const envelope = { fps: 2, durationMs: 1000, frames: [0, 1] };
  assert.equal(sampleAudioMouthEnvelope(envelope, 250), 0.5);
  assert.equal(sampleAudioMouthEnvelope(envelope, -1), 0);
  assert.equal(sampleAudioMouthEnvelope(envelope, 1000), 0);
});

test("invalid rates, mismatched channels and oversized audio are rejected", () => {
  assert.throws(() => buildAudioMouthEnvelope({ channels: [new Float32Array(10)], sampleRate: 24_000 }), /duration/);
  assert.throws(() => buildAudioMouthEnvelope({ channels: [new Float32Array(24_000)], sampleRate: 24_000, fps: 0 }), /fps/);
  assert.throws(() => buildAudioMouthEnvelope({ channels: [new Float32Array(24_000), new Float32Array(12_000)], sampleRate: 24_000 }), /same sample count/);
  assert.throws(() => buildAudioMouthEnvelope({ channels: [new Float32Array(24_000 * 31)], sampleRate: 24_000 }), /30 seconds/);
  assert.throws(() => sampleAudioMouthEnvelope(null, 0), /envelope/);
});

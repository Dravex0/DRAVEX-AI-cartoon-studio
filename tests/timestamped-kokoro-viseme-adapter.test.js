import test from "node:test";
import assert from "node:assert/strict";
import { buildTimestampedKokoroVisemeEvents } from "../src/timestamped-kokoro-viseme-adapter.js";

test("maps HeadTTS Oculus visemes to timestamped DRAVEX mouth shapes", () => {
  const events = buildTimestampedKokoroVisemeEvents({
    visemes: ["PP", "aa", "I", "O", "FF", "SS"],
    vtimes: [0, 100, 220, 360, 510, 640],
    vdurations: [100, 120, 140, 150, 130, 120],
    durationMs: 800
  });
  assert.deepEqual(events.map(event => event.shape), [
    "closed", "open", "wide", "round", "teeth", "teeth"
  ]);
  assert.equal(events[3].startMs, 360);
  assert.equal(events[3].durationMs, 150);
  assert.ok(Object.isFrozen(events));
  assert.ok(events.every(Object.isFrozen));
});

test("clamps small model timestamp overrun to the measured WAV duration", () => {
  const [event] = buildTimestampedKokoroVisemeEvents({
    visemes: ["aa"], vtimes: [950], vdurations: [70], durationMs: 1000
  });
  assert.equal(event.durationMs, 50);
});

test("rejects mismatched arrays, unknown visemes and invalid timestamp ordering", () => {
  assert.throws(() => buildTimestampedKokoroVisemeEvents({
    visemes: ["aa"], vtimes: [], vdurations: [100], durationMs: 1000
  }), /equal length/);
  assert.throws(() => buildTimestampedKokoroVisemeEvents({
    visemes: ["not-real"], vtimes: [0], vdurations: [100], durationMs: 1000
  }), /Invalid timestamped Kokoro viseme/);
  assert.throws(() => buildTimestampedKokoroVisemeEvents({
    visemes: ["aa", "PP"], vtimes: [200, 100], vdurations: [100, 100], durationMs: 1000
  }), /Invalid timestamped Kokoro viseme/);
  assert.throws(() => buildTimestampedKokoroVisemeEvents({
    visemes: ["aa"], vtimes: [950], vdurations: [101], durationMs: 1000
  }), /Invalid timestamped Kokoro viseme/);
});


test("maps punctuation and silent HeadTTS phonemes to neutral mouth events", () => {
  const events = buildTimestampedKokoroVisemeEvents({
    visemes: [null, "aa", null],
    vtimes: [0, 100, 400],
    vdurations: [100, 300, 100],
    durationMs: 500
  });
  assert.deepEqual(events.map(event => event.shape), ["neutral", "open", "neutral"]);
});

import test from "node:test";
import assert from "node:assert/strict";
import { getAudioTimelineOffsetMs } from "../src/audio-clock-alignment.js";

test("preserves a negative offset when audio is scheduled before recording", () => {
  assert.equal(getAudioTimelineOffsetMs(980, 1000), -20);
});

test("preserves a positive offset when audio is scheduled after recording", () => {
  assert.equal(getAudioTimelineOffsetMs(1025, 1000), 25);
});

test("returns zero when both clocks start together", () => {
  assert.equal(getAudioTimelineOffsetMs(1000, 1000), 0);
});

test("rejects non-finite clock timestamps", () => {
  assert.throws(() => getAudioTimelineOffsetMs(Number.NaN, 1000), /finite numbers/);
  assert.throws(() => getAudioTimelineOffsetMs(1000, Infinity), /finite numbers/);
});

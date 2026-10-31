import test from "node:test";
import assert from "node:assert/strict";
import { createAnimationClock } from "../src/animation-clock.js";

test("accumulates real elapsed time instead of counting animation frames", () => {
  const clock = createAnimationClock();
  assert.equal(clock.advance(1000, true), 0);
  assert.equal(clock.advance(1016, true), 16);
  assert.equal(clock.advance(1033, true), 33);
  assert.equal(clock.advance(1067, true), 67);
});

test("does not advance while paused and resumes without including pause duration", () => {
  const clock = createAnimationClock();
  clock.advance(100, true);
  assert.equal(clock.advance(120, true), 20);
  assert.equal(clock.advance(5000, false), 20);
  assert.equal(clock.advance(9000, true), 20);
  assert.equal(clock.advance(9016, true), 36);
});

test("does not move backward if timestamps arrive out of order", () => {
  const clock = createAnimationClock();
  clock.advance(100, true);
  assert.equal(clock.advance(90, true), 0);
  assert.equal(clock.advance(110, true), 10);
});

test("supports resetting the animation epoch", () => {
  const clock = createAnimationClock(250);
  assert.equal(clock.getElapsedMs(), 250);
  assert.equal(clock.advance(1000, true), 250);
  assert.equal(clock.advance(1025, true), 275);
  assert.equal(clock.reset(), 0);
  assert.equal(clock.advance(5000, true), 0);
});

test("rejects invalid timestamps, initial time and playback flags", () => {
  assert.throws(() => createAnimationClock(-1), /non-negative finite number/);
  const clock = createAnimationClock();
  assert.throws(() => clock.advance(Number.NaN, true), /non-negative finite number/);
  assert.throws(() => clock.advance(1, "yes"), /boolean/);
  assert.throws(() => clock.reset(Infinity), /non-negative finite number/);
});

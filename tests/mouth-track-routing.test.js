import test from "node:test";
import assert from "node:assert/strict";
import { findActiveMouthTrack } from "../src/mouth-track-routing.js";

const track = (characterId, sceneIndex, startMs, durationMs = 500) => ({
  characterId,
  sceneIndex,
  startMs,
  envelope: { durationMs }
});

test("routes a mouth track only to the matching character in the active scene", () => {
  const fox = track("Foxy", 1, 100);
  const bird = track("Bird", 1, 100);
  assert.equal(findActiveMouthTrack([fox, bird], {
    sceneIndex: 1, elapsedMs: 250, characterId: "Foxy"
  }), fox);
  assert.equal(findActiveMouthTrack([fox, bird], {
    sceneIndex: 1, elapsedMs: 250, characterId: "Bird"
  }), bird);
});

test("speaker matching is case-insensitive and trims whitespace", () => {
  const item = track(" Blue Bird ", 0, 0);
  assert.equal(findActiveMouthTrack([item], {
    sceneIndex: 0, elapsedMs: 20, characterId: "blue bird"
  }), item);
});

test("does not animate another character or another scene", () => {
  const item = track("Foxy", 2, 0);
  assert.equal(findActiveMouthTrack([item], {
    sceneIndex: 1, elapsedMs: 20, characterId: "Foxy"
  }), null);
  assert.equal(findActiveMouthTrack([item], {
    sceneIndex: 2, elapsedMs: 20, characterId: "Bird"
  }), null);
});

test("uses the most recently started cue when same-speaker cues overlap", () => {
  const earlier = track("Foxy", 0, 0, 1000);
  const later = track("Foxy", 0, 200, 500);
  assert.equal(findActiveMouthTrack([earlier, later], {
    sceneIndex: 0, elapsedMs: 250, characterId: "Foxy"
  }), later);
});

test("treats cue start as inclusive and cue end as exclusive", () => {
  const item = track("Foxy", 0, 100, 200);
  assert.equal(findActiveMouthTrack([item], {
    sceneIndex: 0, elapsedMs: 100, characterId: "Foxy"
  }), item);
  assert.equal(findActiveMouthTrack([item], {
    sceneIndex: 0, elapsedMs: 300, characterId: "Foxy"
  }), null);
});

test("validates request inputs and safely ignores malformed tracks", () => {
  assert.throws(() => findActiveMouthTrack(null, {}), /tracks must be an array/);
  assert.throws(() => findActiveMouthTrack([], { sceneIndex: -1 }), /sceneIndex/);
  assert.throws(() => findActiveMouthTrack([], { sceneIndex: 0, elapsedMs: NaN }), /elapsedMs/);
  assert.equal(findActiveMouthTrack([null, {}, track("Foxy", 0, -1)], {
    sceneIndex: 0, elapsedMs: 10, characterId: "Foxy"
  }), null);
});

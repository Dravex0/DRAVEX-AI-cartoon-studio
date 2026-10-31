import test from "node:test";
import assert from "node:assert/strict";
import { syncSceneVideoPlayback } from "../src/scene-video-transport.js";

function fakeVideo({ paused = true, currentTime = 4 } = {}) {
  const calls = [];
  return {
    paused,
    currentTime,
    calls,
    pause() { this.paused = true; calls.push("pause"); },
    play() { this.paused = false; calls.push("play"); return Promise.resolve(); }
  };
}

test("plays only the active scene video and pauses every inactive scene", () => {
  const first = fakeVideo({ paused: true });
  const second = fakeVideo({ paused: false });
  const cache = new Map([
    ["scene-1", { video: first }],
    ["scene-2", { video: second }]
  ]);

  syncSceneVideoPlayback({ cache, activeKey: "scene-1", shouldPlay: true });

  assert.deepEqual(first.calls, ["play"]);
  assert.deepEqual(second.calls, ["pause"]);
  assert.equal(first.paused, false);
  assert.equal(second.paused, true);
});

test("restarts the active scene video at time zero on scene entry", () => {
  const video = fakeVideo({ paused: false, currentTime: 8 });
  const cache = new Map([["scene-1", { video }]]);

  syncSceneVideoPlayback({ cache, activeKey: "scene-1", shouldPlay: true, restart: true });

  assert.equal(video.currentTime, 0);
  assert.equal(video.paused, false);
  assert.deepEqual(video.calls, []);
});

test("pauses all scene videos when storyboard playback is paused", () => {
  const first = fakeVideo({ paused: false });
  const second = fakeVideo({ paused: false });
  const cache = new Map([
    ["scene-1", { video: first }],
    ["scene-2", { video: second }]
  ]);

  syncSceneVideoPlayback({ cache, activeKey: "scene-1", shouldPlay: false });

  assert.deepEqual(first.calls, ["pause"]);
  assert.deepEqual(second.calls, ["pause"]);
});

test("rejects malformed video caches and playback flags", () => {
  assert.throws(() => syncSceneVideoPlayback({ cache: [] }), /Map/);
  assert.throws(() => syncSceneVideoPlayback({ cache: new Map(), shouldPlay: "yes" }), /booleans/);
  assert.throws(() => syncSceneVideoPlayback({
    cache: new Map([["scene-1", {}]])
  }), /playable video element/);
});

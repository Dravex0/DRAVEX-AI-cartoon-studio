import test from "node:test";
import assert from "node:assert/strict";
import { waitForSceneVideoReady } from "../src/scene-video-readiness.js";

class FakeVideo extends EventTarget {
  constructor({ readyState = 0, videoWidth = 0, error = null } = {}) {
    super();
    this.readyState = readyState;
    this.videoWidth = videoWidth;
    this.videoHeight = videoWidth > 0 ? 360 : 0;
    this.duration = readyState >= 2 && videoWidth > 0 ? 5 : NaN;
    this.error = error;
  }
  becomeReady() {
    this.readyState = 2;
    this.videoWidth = 640;
    this.videoHeight = 360;
    this.duration = 5;
    this.dispatchEvent(new Event("loadeddata"));
  }
}

test("resolves immediately when a decoded frame is already available", async () => {
  const video = new FakeVideo({ readyState: 2, videoWidth: 640 });
  assert.equal(await waitForSceneVideoReady(video), video);
});

test("waits for decoded frame data instead of accepting metadata only", async () => {
  const video = new FakeVideo({ readyState: 1, videoWidth: 640 });
  const pending = waitForSceneVideoReady(video, { timeoutMs: 100 });
  video.becomeReady();
  assert.equal(await pending, video);
});

test("rejects when the browser reports a video decode error", async () => {
  const video = new FakeVideo();
  const pending = waitForSceneVideoReady(video, { timeoutMs: 100 });
  video.error = { message: "corrupt video" };
  video.dispatchEvent(new Event("error"));
  await assert.rejects(pending, /corrupt video/);
});

test("rejects on timeout when no decoded frame becomes available", async () => {
  const video = new FakeVideo();
  await assert.rejects(
    waitForSceneVideoReady(video, { timeoutMs: 5 }),
    /Timed out waiting for a decoded frame/
  );
});

test("supports cancellation and validates timeout values", async () => {
  const video = new FakeVideo();
  const controller = new AbortController();
  const pending = waitForSceneVideoReady(video, { timeoutMs: 100, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.name === "AbortError");
  await assert.rejects(waitForSceneVideoReady(video, { timeoutMs: 0 }), /positive finite number/);
});


test("counts a scene clip as decoded only with frame dimensions and finite duration", async () => {
  const { isSceneVideoDecoded } = await import("../src/scene-video-readiness.js");
  assert.equal(isSceneVideoDecoded({ readyState: 2, videoWidth: 640, videoHeight: 360, duration: 5 }), true);
  assert.equal(isSceneVideoDecoded({ readyState: 1, videoWidth: 640, videoHeight: 360, duration: 5 }), false);
  assert.equal(isSceneVideoDecoded({ readyState: 2, videoWidth: 0, videoHeight: 360, duration: 5 }), false);
  assert.equal(isSceneVideoDecoded({ readyState: 2, videoWidth: 640, videoHeight: 0, duration: 5 }), false);
  assert.equal(isSceneVideoDecoded({ readyState: 2, videoWidth: 640, videoHeight: 360, duration: Infinity }), false);
  assert.equal(isSceneVideoDecoded({ readyState: 2, videoWidth: 640, videoHeight: 360, duration: 0 }), false);
  assert.equal(isSceneVideoDecoded(null), false);
});

test("does not resolve readiness without finite duration and decoded height", async () => {
  const missingDuration = new FakeVideo({ readyState: 2, videoWidth: 640 });
  missingDuration.duration = Infinity;
  await assert.rejects(
    waitForSceneVideoReady(missingDuration, { timeoutMs: 5 }),
    /Timed out waiting for a decoded frame/
  );

  const missingHeight = new FakeVideo({ readyState: 2, videoWidth: 640 });
  missingHeight.videoHeight = 0;
  await assert.rejects(
    waitForSceneVideoReady(missingHeight, { timeoutMs: 5 }),
    /Timed out waiting for a decoded frame/
  );
});

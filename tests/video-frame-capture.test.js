import test from "node:test";
import assert from "node:assert/strict";
import { createVideoFrameCapture } from "../src/video-frame-capture.js";

class FakeVideo {
  constructor() {
    this.duration = 5;
    this.currentTime = 0;
    this.readyState = 2;
    this.paused = false;
    this.seeking = false;
    this.listeners = new Map();
    this.pauseCalls = 0;
    this.playCalls = 0;
  }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) {
    this.listeners.get(type)?.delete(callback);
  }
  emit(type) {
    for (const callback of this.listeners.get(type) || []) callback();
  }
  pause() { this.paused = true; this.pauseCalls += 1; }
  play() { this.paused = false; this.playCalls += 1; return Promise.resolve(); }
  set currentTime(value) {
    this._currentTime = value;
    this.seeking = true;
    queueMicrotask(() => {
      this.seeking = false;
      this.emit("seeked");
    });
  }
  get currentTime() { return this._currentTime ?? 0; }
}

const bitmap = () => ({ close() {} });

test("captures requested local video frames sequentially and restores playback", async () => {
  const video = new FakeVideo();
  video.currentTime = 1;
  await new Promise(resolve => queueMicrotask(resolve));
  const captured = [];
  const adapter = createVideoFrameCapture(video, {
    createBitmap: async source => {
      captured.push(source.currentTime);
      return bitmap();
    }
  });
  assert.equal(video.paused, true);
  const first = await adapter.captureFrame(1500);
  const second = await adapter.captureFrame(2500);
  assert.equal(typeof first.close, "function");
  assert.equal(typeof second.close, "function");
  assert.deepEqual(captured, [1.5, 2.5]);
  await adapter.restore();
  assert.equal(video.currentTime, 1);
  assert.equal(video.paused, false);
  assert.equal(video.playCalls, 1);
});

test("does not resume playback when the video was originally paused", async () => {
  const video = new FakeVideo();
  video.paused = true;
  const adapter = createVideoFrameCapture(video, { createBitmap: async () => bitmap() });
  await adapter.captureFrame(500);
  await adapter.restore();
  assert.equal(video.playCalls, 0);
  assert.equal(video.paused, true);
});

test("rejects invalid timestamps and prevents concurrent capture", async () => {
  const video = new FakeVideo();
  let release;
  const adapter = createVideoFrameCapture(video, {
    createBitmap: () => new Promise(resolve => { release = resolve; })
  });
  await assert.rejects(adapter.captureFrame(5000), /outside/);
  const pending = adapter.captureFrame(1000);
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(adapter.captureFrame(1500), /already running/);
  release(bitmap());
  await pending;
  await adapter.restore();
});

test("closes a bitmap if cancellation occurs after bitmap creation", async () => {
  const video = new FakeVideo();
  const controller = new AbortController();
  const frame = { closed: false, close() { this.closed = true; } };
  const adapter = createVideoFrameCapture(video, {
    createBitmap: async () => {
      controller.abort();
      return frame;
    }
  });
  await assert.rejects(adapter.captureFrame(500, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(frame.closed, true);
  await adapter.restore();
});

test("requires createImageBitmap support", () => {
  const video = new FakeVideo();
  assert.throws(() => createVideoFrameCapture(video, { createBitmap: null }), /not supported/);
});

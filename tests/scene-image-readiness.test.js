import test from "node:test";
import assert from "node:assert/strict";
import { waitForSceneImageReady } from "../src/scene-video-readiness.js";

class FakeImage extends EventTarget {
  constructor({ complete = false, naturalWidth = 0 } = {}) {
    super();
    this.complete = complete;
    this.naturalWidth = naturalWidth;
  }
  becomeReady() {
    this.complete = true;
    this.naturalWidth = 1024;
    this.dispatchEvent(new Event("load"));
  }
}

test("resolves immediately when a generated image is decoded", async () => {
  const image = new FakeImage({ complete: true, naturalWidth: 1024 });
  assert.equal(await waitForSceneImageReady(image), image);
});

test("waits for the generated image load event before export", async () => {
  const image = new FakeImage();
  const pending = waitForSceneImageReady(image, { timeoutMs: 100 });
  image.becomeReady();
  assert.equal(await pending, image);
});

test("rejects when the generated image fails to load or pass CORS", async () => {
  const image = new FakeImage();
  const pending = waitForSceneImageReady(image, { timeoutMs: 100 });
  image.complete = true;
  image.dispatchEvent(new Event("error"));
  await assert.rejects(pending, /network or CORS error/);
});

test("rejects when an image is complete but has no decoded pixels", async () => {
  const image = new FakeImage({ complete: true, naturalWidth: 0 });
  await assert.rejects(waitForSceneImageReady(image), /failed to load or decode/);
});

test("rejects when generated image decoding exceeds the timeout", async () => {
  const image = new FakeImage();
  await assert.rejects(
    waitForSceneImageReady(image, { timeoutMs: 5 }),
    /Timed out waiting for the generated scene image/
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { captureLastFrameImage } from "../src/video-last-frame.js";

test("extracts the last decoded frame as a PNG and releases temporary resources", async () => {
  const calls = [];
  const bitmap = {
    width: 640,
    height: 360,
    close() { calls.push("bitmap-close"); }
  };
  const video = {
    duration: 4,
    paused: true,
    load() { calls.push("load"); },
    pause() { calls.push("pause"); },
    removeAttribute(name) { calls.push("remove-" + name); }
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext(type) {
      assert.equal(type, "2d");
      return { drawImage: (...args) => calls.push(["draw", ...args.slice(1)]) };
    },
    toBlob(callback, type) {
      calls.push(["encode", type, this.width, this.height]);
      callback(new Blob(["png"], { type }));
    }
  };

  const image = await captureLastFrameImage(new Blob(["video"], { type: "video/webm" }), {
    createVideoElement: () => video,
    createCanvas: () => canvas,
    createObjectURL: () => "blob:previous-scene",
    revokeObjectURL: url => calls.push(["revoke", url]),
    waitForReady: async (element, options) => {
      assert.equal(element.src, "blob:previous-scene");
      assert.equal(options.timeoutMs, 20000);
      calls.push("ready");
    },
    createFrameCapture: element => {
      assert.equal(element, video);
      return {
        captureFrame: async (timestampMs, options) => {
          assert.equal(options.signal, undefined);
          calls.push(["capture", timestampMs]);
          return bitmap;
        },
        restore: async () => calls.push("restore")
      };
    }
  });

  assert.equal(image.type, "image/png");
  assert.equal(image.size, 3);
  assert.deepEqual(calls.filter(item => Array.isArray(item) && item[0] === "capture")[0], ["capture", 3920]);
  assert.ok(calls.includes("bitmap-close"));
  assert.ok(calls.includes("restore"));
  assert.ok(calls.some(item => Array.isArray(item) && item[0] === "revoke"));
  assert.equal(canvas.width, 640);
  assert.equal(canvas.height, 360);
});

test("rejects empty video artifacts before creating browser resources", async () => {
  let created = false;
  await assert.rejects(
    captureLastFrameImage(new Blob([]), {
      createVideoElement: () => { created = true; return {}; }
    }),
    /non-empty previous scene video/
  );
  assert.equal(created, false);
});

test("honors an already-aborted signal before decoding", async () => {
  const controller = new AbortController();
  controller.abort();
  let created = false;
  await assert.rejects(
    captureLastFrameImage(new Blob(["video"], { type: "video/webm" }), {
      signal: controller.signal,
      createVideoElement: () => { created = true; return {}; }
    }),
    error => error.name === "AbortError"
  );
  assert.equal(created, false);
});

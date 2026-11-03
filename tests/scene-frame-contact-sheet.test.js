import test from "node:test";
import assert from "node:assert/strict";
import { createSceneFrameContactSheet } from "../src/scene-frame-contact-sheet.js";

test("creates a local downloadable contact sheet from captured frames", async () => {
  const drawn = [];
  const labels = [];
  const canvasFactory = () => ({
    width: 0,
    height: 0,
    getContext: () => ({
      fillRect() {},
      drawImage(image, x, y, width, height) { drawn.push({ image, x, y, width, height }); },
      fillText(text, x, y) { labels.push({ text, x, y }); }
    }),
    toBlob(callback, type) { callback(new Blob(["frame-sheet"], { type })); }
  });
  const imageFactory = () => {
    const image = { width: 160, height: 90, complete: false };
    Object.defineProperty(image, "src", { set() { queueMicrotask(() => { image.complete = true; image.onload(); }); } });
    return image;
  };
  const blob = await createSceneFrameContactSheet([
    { time: 0.32, dataUrl: "data:image/jpeg;base64,AA==" },
    { time: 2, dataUrl: "data:image/jpeg;base64,BB==" },
    { time: 3.68, dataUrl: "data:image/jpeg;base64,CC==" }
  ], { canvasFactory, imageFactory });
  assert.equal(blob.type, "image/jpeg");
  assert.equal(blob.size, 11);
  assert.equal(drawn.length, 3);
  assert.equal(labels.map(item => item.text).join(", "), "0.32 s, 2.00 s, 3.68 s");
});

test("rejects invalid contact sheet samples", async () => {
  await assert.rejects(createSceneFrameContactSheet([]), /between 1 and 5/);
  await assert.rejects(createSceneFrameContactSheet([{ time: -1, dataUrl: "data:image/jpeg;base64,AA==" }]), /valid timestamp/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createCharacterBodyPartContactSheet } from "../src/character-motion-evidence.js";

function makeCanvas() {
  const context = {
    fillRect() {}, fillText() {}, drawImage() {}, putImageData() {}
  };
  return {
    width: 0, height: 0,
    getContext() { return context; },
    toBlob(callback) { callback(new Blob(["jpeg-evidence"], { type: "image/jpeg" })); }
  };
}
function entry(bodyPart = "left-arm") {
  return {
    characterId: "Foxy",
    bodyPart,
    frames: Array.from({ length: 5 }, () => ({
      width: 2, height: 2, data: new Uint8ClampedArray(16)
    }))
  };
}

test("creates a downloadable contact sheet from sampled body-part frames", async () => {
  const canvases = [];
  const blob = await createCharacterBodyPartContactSheet([entry("right-arm"), entry("head")], {
    canvasFactory: () => { const canvas = makeCanvas(); canvases.push(canvas); return canvas; }
  });
  assert.equal(blob.type, "image/jpeg");
  assert.equal(canvases[0].width, 156 + 5 * 112);
  assert.equal(canvases[0].height, 38 + 2 * 112);
  assert.equal(canvases.length, 1 + 10);
});

test("rejects empty entries and malformed frame data", async () => {
  await assert.rejects(() => createCharacterBodyPartContactSheet([]), /between 1 and 60/);
  const invalid = entry();
  invalid.frames[0].data = new Uint8ClampedArray(4);
  await assert.rejects(() => createCharacterBodyPartContactSheet([invalid], { canvasFactory: makeCanvas }), /invalid/);
});

test("rejects unknown body-part identifiers and excessive frame counts", async () => {
  await assert.rejects(() => createCharacterBodyPartContactSheet([entry("wing")], { canvasFactory: makeCanvas }), /invalid/);
  const tooMany = entry();
  tooMany.frames.push({ width: 2, height: 2, data: new Uint8ClampedArray(16) });
  await assert.rejects(() => createCharacterBodyPartContactSheet([tooMany], { canvasFactory: makeCanvas }), /invalid/);
});

test("rejects invalid rendering options", async () => {
  await assert.rejects(() => createCharacterBodyPartContactSheet([entry()], { canvasFactory: makeCanvas, quality: 2 }), /quality/);
});

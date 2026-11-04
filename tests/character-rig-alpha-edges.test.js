import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRigPartAlphaEdges } from "../src/character-rig-alpha-edges.js";

function imageWithAlpha(width, height, alphaAt) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 120;
    data[i + 3] = alphaAt(x, y);
  }
  return { width, height, data };
}
function canvasFactoryFor(image) {
  return () => {
    const canvas = { width: 0, height: 0 };
    canvas.getContext = () => ({
      drawImage() {},
      getImageData() { return { data: image.data }; }
    });
    return canvas;
  };
}
const rig = { characterId: "Foxy", parts: [{ id: "torso", imageUrl: "blob:torso" }] };

test("reports opaque pixels on all four image edges", () => {
  const image = imageWithAlpha(10, 10, () => 255);
  const report = analyzeRigPartAlphaEdges({ rig, resolveImage: () => image, canvasFactory: canvasFactoryFor(image) });
  assert.equal(report.status, "complete");
  assert.equal(report.parts[0].edges.top.opaqueRatio, 1);
  assert.equal(report.parts[0].edges.right.status, "alpha-present");
});
test("detects transparent edge bands without calling them joint defects", () => {
  const image = imageWithAlpha(10, 10, (x) => x < 2 ? 0 : 255);
  const report = analyzeRigPartAlphaEdges({ rig, resolveImage: () => image, canvasFactory: canvasFactoryFor(image) });
  assert.equal(report.parts[0].edges.left.status, "mostly-transparent");
  assert.equal(report.parts[0].edges.right.status, "alpha-present");
  assert.match(report.limitation, /cannot confirm a visible seam/);
});
test("reports unavailable images and CORS-tainted pixel access", () => {
  const unavailable = analyzeRigPartAlphaEdges({ rig, resolveImage: () => null });
  assert.equal(unavailable.status, "unavailable");
  const tainted = analyzeRigPartAlphaEdges({
    rig, resolveImage: () => ({ width: 2, height: 2 }),
    canvasFactory: () => ({ width: 0, height: 0, getContext: () => ({ drawImage(){}, getImageData(){ const error = new Error(); error.name = "SecurityError"; throw error; } }) })
  });
  assert.equal(tainted.parts[0].reason, "cors-tainted-canvas");
});
test("validates options and caps processing to supported rig parts", () => {
  assert.throws(() => analyzeRigPartAlphaEdges({ rig, resolveImage: () => null, alphaThreshold: 300 }), /alphaThreshold/);
  assert.throws(() => analyzeRigPartAlphaEdges({ rig, resolveImage: () => null, edgeDepthRatio: 0 }), /ratios/);
  assert.throws(() => analyzeRigPartAlphaEdges({ rig: {}, resolveImage: () => null }), /rig with parts/);
});

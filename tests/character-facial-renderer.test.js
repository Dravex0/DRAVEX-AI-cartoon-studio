import test from "node:test";
import assert from "node:assert/strict";
import { drawCharacterFacialRigs } from "../src/character-facial-renderer.js";

const rig = () => ({
  schemaVersion: 1,
  characterId: "Foxy",
  headBoneId: "head",
  parts: [
    { id: "eye", role: "eye-left", imageUrl: "blob:eye", x: 0.5, y: 0.4, width: 0.08, height: 0.06, zIndex: 1 },
    { id: "brow", role: "brow-left", imageUrl: "blob:brow", x: 0.5, y: 0.3, width: 0.1, height: 0.03, zIndex: 2 },
    { id: "mouth", role: "mouth", imageUrl: "blob:mouth", x: 0.5, y: 0.55, width: 0.08, height: 0.04, zIndex: 3 }
  ]
});
const bodyRig = { schemaVersion: 1, characterId: "Foxy", bones: [{ id: "root" }, { id: "head", parentId: "root" }], parts: [{ id: "body", boneId: "root", imageUrl: "blob:body" }] };

function contextRecorder() {
  const calls = [];
  return {
    calls,
    globalAlpha: 1,
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    translate(x, y) { calls.push(["translate", x, y]); },
    rotate(value) { calls.push(["rotate", value]); },
    scale(x, y) { calls.push(["scale", x, y]); },
    drawImage(image) { calls.push(["drawImage", image.id]); }
  };
}

test("renders explicit facial parts in z-order without replacing body layers", () => {
  const context = contextRecorder();
  const images = Object.fromEntries(["eye", "brow", "mouth"].map(id => ["blob:" + id, { id, width: 20, height: 20 }]));
  const result = drawCharacterFacialRigs(context, [rig()], key => images[key], 1000, 500, { characterRigs: [bodyRig] });
  assert.equal(result.drawn, 3);
  assert.equal(result.skipped, 0);
  assert.deepEqual(result.readyCharacterIds, ["Foxy"]);
  assert.deepEqual(context.calls.filter(call => call[0] === "drawImage").map(call => call[1]), ["eye", "brow", "mouth"]);
});

test("applies expression controls and timestamped viseme shape to facial parts", () => {
  const context = contextRecorder();
  const result = drawCharacterFacialRigs(context, [rig()], () => ({ width: 20, height: 20 }), 1000, 500, {
    facialExpressions: { Foxy: { eyeOpen: 0.5, browY: 0.5, browRotation: 0.2, mouthWidth: 1.2, mouthOpen: 0.1 } },
    facialVisemes: { Foxy: "open" },
    facialMouthOpenness: { Foxy: 0.8 }
  });
  assert.equal(result.drawn, 3);
  assert.ok(context.calls.some(call => call[0] === "scale" && call[1] === 1 && call[2] === 0.5));
  assert.ok(context.calls.some(call => call[0] === "scale" && Math.abs(call[1] - 1.2) < 1e-9 && Math.abs(call[2] - 0.72) < 1e-9));
  assert.ok(context.calls.some(call => call[0] === "rotate" && Math.abs(call[1]) > 0));
});

test("matches expression and dialogue controls when character ID casing differs", () => {
  const context = contextRecorder();
  drawCharacterFacialRigs(context, [rig()], () => ({ width: 20, height: 20 }), 1000, 500, {
    facialExpressions: { fOxY: { mouthOpen: 0.1, mouthShape: "round" } },
    facialVisemes: { FOXY: "open" },
    facialMouthOpenness: { foxY: 0.5 }
  });
  assert.ok(context.calls.some(call => call[0] === "scale"
    && Math.abs(call[1] - 1) < 1e-9
    && Math.abs(call[2] - 0.45) < 1e-9));
});

test("uses expression preset mouth shape when no dialogue viseme is active", () => {
  const context = contextRecorder();
  drawCharacterFacialRigs(context, [rig()], () => ({ width: 20, height: 20 }), 1000, 500, {
    facialExpressions: { Foxy: { mouthShape: "round", mouthOpen: 0.1 } }
  });
  assert.ok(context.calls.some(call => call[0] === "scale"
    && Math.abs(call[1] - 1) < 1e-9
    && Math.abs(call[2] - 0.62) < 1e-9));
});

test("active dialogue viseme overrides the expression preset mouth shape", () => {
  const context = contextRecorder();
  drawCharacterFacialRigs(context, [rig()], () => ({ width: 20, height: 20 }), 1000, 500, {
    facialExpressions: { Foxy: { mouthShape: "round", mouthOpen: 0.1 } },
    facialVisemes: { Foxy: "open" },
    facialMouthOpenness: { Foxy: 0.5 }
  });
  assert.ok(context.calls.some(call => call[0] === "scale"
    && Math.abs(call[1] - 1) < 1e-9
    && Math.abs(call[2] - 0.45) < 1e-9));
});

test("animates a separate jaw layer from the active mouth-opening control", () => {
  const context = contextRecorder();
  const candidate = rig();
  candidate.parts.push({
    id: "jaw", role: "jaw", imageUrl: "blob:jaw",
    x: 0.5, y: 0.58, width: 0.09, height: 0.05, zIndex: 4
  });
  drawCharacterFacialRigs(context, [candidate], () => ({ width: 20, height: 20 }), 1000, 500, {
    facialExpressions: { Foxy: { mouthOpen: 0.8 } }
  });
  const translations = context.calls.filter(call => call[0] === "translate");
  const rotations = context.calls.filter(call => call[0] === "rotate");
  assert.equal(translations.length, 4);
  assert.ok(translations[3][2] > 0.58 * 500);
  assert.ok(rotations[3][1] > 0);
});

test("skips incomplete facial images but leaves fallback responsibility to caller", () => {
  const result = drawCharacterFacialRigs(contextRecorder(), [rig()], key => key === "blob:eye" ? { width: 10, height: 10 } : null, 500, 500);
  assert.equal(result.drawn, 1);
  assert.equal(result.skipped, 2);
  assert.deepEqual(result.readyCharacterIds, ["Foxy"]);
});

test("rejects facial rig whose head bone does not exist in its body rig", () => {
  const invalidBody = { ...bodyRig, bones: [{ id: "root" }] };
  const result = drawCharacterFacialRigs(contextRecorder(), [rig()], () => ({ width: 10, height: 10 }), 500, 500, { characterRigs: [invalidBody] });
  assert.equal(result.drawn, 0);
  assert.equal(result.skipped, 1);
});

test("anchors facial parts to the posed head bone translation and rotation", () => {
  const context = contextRecorder();
  const riggedBody = {
    ...bodyRig,
    parts: [{ id: "head-part", boneId: "head", imageUrl: "blob:head", x: 0.5, y: 0.4, rotation: 0 }]
  };
  drawCharacterFacialRigs(context, [rig()], () => ({ width: 10, height: 10 }), 1000, 500, {
    characterRigs: [riggedBody],
    rigPoses: { Foxy: { root: { x: 0.1, y: -0.05 }, head: { rotation: Math.PI / 2 } } }
  });
  const translations = context.calls.filter(call => call[0] === "translate");
  assert.ok(translations.some(call => Math.abs(call[1] - 600) < 1e-9 && Math.abs(call[2] - 175) < 1e-9));
  assert.ok(context.calls.some(call => call[0] === "rotate" && Math.abs(call[1] - Math.PI / 2) < 1e-9));
});

test("returns a safe empty result for invalid canvas dimensions", () => {
  const result = drawCharacterFacialRigs(contextRecorder(), [rig()], () => ({ width: 10, height: 10 }), 0, 500);
  assert.deepEqual(result, { drawn: 0, skipped: 1, readyCharacterIds: [] });
});

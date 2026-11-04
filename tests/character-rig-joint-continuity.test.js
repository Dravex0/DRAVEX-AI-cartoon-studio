import test from "node:test";
import assert from "node:assert/strict";
import { buildCharacterRigAssetPlan } from "../src/character-rig-asset-plan.js";
import { analyzeCharacterRigJointContinuity } from "../src/character-rig-joint-continuity.js";

function makeRig() {
  const plan = buildCharacterRigAssetPlan({
    characterId: "Foxy",
    appearanceReference: "Orange fox, cream muzzle, green scarf"
  });
  return {
    ...plan.rig,
    parts: plan.rig.parts.map(part => ({ ...part, imageUrl: "https://assets.example/" + part.id + ".png" }))
  };
}

const viewport = { width: 640, height: 360 };

test("recognizes connected parent/child body-part rectangles", () => {
  const report = analyzeCharacterRigJointContinuity({ rig: makeRig(), viewport });
  assert.equal(report.status, "geometry-overlap-or-near");
  assert.ok(report.checkedConnections >= 6);
  assert.equal(report.possibleGapCount, 0);
});

test("reports a possible geometric gap after a child part is displaced", () => {
  const rig = makeRig();
  rig.parts = rig.parts.map(part => part.id === "arm-left-lower" ? { ...part, x: 1.5 } : part);
  const report = analyzeCharacterRigJointContinuity({ rig, viewport, tolerancePx: 4 });
  assert.equal(report.status, "possible-joint-gaps");
  assert.ok(report.joints.some(joint => joint.childBoneId === "arm-left-lower"
    && joint.status === "possible-geometry-gap"));
});

test("camera zoom scales a measurable joint gap", () => {
  const rig = makeRig();
  rig.parts = rig.parts.map(part => part.id === "arm-left-lower"
    ? { ...part, x: 0.505 }
    : part);
  const normal = analyzeCharacterRigJointContinuity({ rig, viewport });
  const zoomed = analyzeCharacterRigJointContinuity({
    rig,
    viewport,
    camera: { zoom: 1.6 }
  });
  const gapFor = report => report.joints.find(item => item.childBoneId === "arm-left-lower").gapPx;
  assert.ok(gapFor(normal) > 0);
  assert.ok(gapFor(zoomed) > gapFor(normal));
});

test("reports incomplete connections rather than inventing missing parts", () => {
  const rig = makeRig();
  rig.parts = rig.parts.filter(part => part.id !== "arm-left-upper");
  const report = analyzeCharacterRigJointContinuity({ rig, viewport });
  assert.equal(report.status, "incomplete");
  assert.ok(report.skippedConnections >= 1);
});

test("rejects invalid viewport, tolerance and rig", () => {
  assert.throws(() => analyzeCharacterRigJointContinuity({ rig: makeRig(), viewport: { width: 0, height: 360 } }), /positive viewport/);
  assert.throws(() => analyzeCharacterRigJointContinuity({ rig: makeRig(), viewport, tolerancePx: -1 }), /tolerancePx/);
  const invalid = analyzeCharacterRigJointContinuity({ rig: {}, viewport });
  assert.equal(invalid.status, "invalid-rig");
  assert.equal(invalid.joints.length, 0);
});

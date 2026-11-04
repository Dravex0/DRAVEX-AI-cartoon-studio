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

test("pose and camera transforms affect joint geometry", () => {
  const rig = makeRig();
  const neutral = analyzeCharacterRigJointContinuity({ rig, viewport });
  const posed = analyzeCharacterRigJointContinuity({
    rig,
    viewport,
    rigPose: { "arm-left-upper": { rotation: 1.1 }, "arm-left-lower": { rotation: -0.5 } },
    camera: { zoom: 1.6, offsetY: 12 }
  });
  assert.notDeepEqual(
    neutral.joints.map(item => item.gapPx),
    posed.joints.map(item => item.gapPx)
  );
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

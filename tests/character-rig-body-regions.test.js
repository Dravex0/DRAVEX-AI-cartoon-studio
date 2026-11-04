import test from "node:test";
import assert from "node:assert/strict";
import { buildCharacterRigAssetPlan } from "../src/character-rig-asset-plan.js";
import { buildCharacterBodyPartRegions } from "../src/character-rig-body-regions.js";

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

test("builds separate regions for head, torso, both arms and both legs", () => {
  const result = buildCharacterBodyPartRegions({
    rig: makeRig(),
    viewport: { width: 640, height: 360 }
  });
  assert.equal(result.status, "complete");
  assert.deepEqual(result.regions.map(item => item.bodyPart), [
    "head", "torso", "left-arm", "right-arm", "left-leg", "right-leg"
  ]);
  assert.ok(result.regions.every(item => item.bounds.width > 0 && item.bounds.height > 0));
});

test("body-part bounds follow the current rig pose", () => {
  const rig = makeRig();
  const neutral = buildCharacterBodyPartRegions({ rig, viewport: { width: 640, height: 360 } });
  const posed = buildCharacterBodyPartRegions({
    rig,
    rigPose: { "arm-left-upper": { rotation: 0.8 }, "arm-left-lower": { rotation: -0.3 } },
    viewport: { width: 640, height: 360 }
  });
  const get = (report, id) => report.regions.find(item => item.bodyPart === id).bounds;
  assert.notDeepEqual(get(neutral, "left-arm"), get(posed, "left-arm"));
  assert.deepEqual(get(neutral, "right-arm"), get(posed, "right-arm"));
});

test("camera zoom and offset are reflected in body-part sample bounds", () => {
  const rig = makeRig();
  const normal = buildCharacterBodyPartRegions({ rig, viewport: { width: 640, height: 360 } });
  const zoomed = buildCharacterBodyPartRegions({
    rig, viewport: { width: 640, height: 360 }, camera: { zoom: 1.5, offsetY: 20 }
  });
  const head = report => report.regions.find(item => item.bodyPart === "head").bounds;
  assert.notDeepEqual(head(normal), head(zoomed));
});

test("reports missing body groups instead of inventing fixed regions", () => {
  const rig = makeRig();
  rig.parts = rig.parts.filter(part => !part.boneId.startsWith("leg-"));
  const result = buildCharacterBodyPartRegions({ rig, viewport: { width: 640, height: 360 } });
  assert.equal(result.status, "partial");
  assert.deepEqual(result.missing, ["left-leg", "right-leg"]);
});

test("rejects invalid viewport and reports invalid rig", () => {
  assert.throws(() => buildCharacterBodyPartRegions({ rig: makeRig(), viewport: { width: 0, height: 360 } }), /positive viewport/);
  const result = buildCharacterBodyPartRegions({ rig: {}, viewport: { width: 640, height: 360 } });
  assert.equal(result.status, "invalid-rig");
  assert.equal(result.regions.length, 0);
});

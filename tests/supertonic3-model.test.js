import test from "node:test";
import assert from "node:assert/strict";
import {
  SUPERTONIC3_MODEL,
  getSupertonic3Model,
  getSupertonic3AssetUrls,
  listSupertonic3Voices
} from "../src/supertonic3-model.js";

test("Supertonic 3 exposes Russian and Ukrainian only after explicit OpenRAIL-M review", () => {
  for (const locale of ["ru", "uk", "ru-RU", "uk-UA"]) {
    const blocked = getSupertonic3Model(locale);
    assert.equal(blocked.available, false);
    assert.equal(blocked.reason, "license-review-required");
    assert.equal(blocked.license, "OpenRAIL-M");

    const allowed = getSupertonic3Model(locale, { acceptOpenRailTerms: true });
    assert.equal(allowed.available, true);
    assert.equal(allowed.locale, locale.slice(0, 2));
    assert.equal(allowed.archived, true);
  }
});

test("does not mislabel model weights as MIT or silently permit unreviewed terms", () => {
  assert.equal(SUPERTONIC3_MODEL.license, "OpenRAIL-M");
  assert.equal(SUPERTONIC3_MODEL.codeLicense, "MIT");
  assert.notEqual(SUPERTONIC3_MODEL.license, SUPERTONIC3_MODEL.codeLicense);
  assert.equal(getSupertonic3Model("ru").available, false);
});

test("publishes ten fixed voice presets for deterministic character assignment", () => {
  assert.deepEqual(listSupertonic3Voices(), [
    "M1", "M2", "M3", "M4", "M5", "F1", "F2", "F3", "F4", "F5"
  ]);
  const first = getSupertonic3Model("uk", { acceptOpenRailTerms: true });
  first.voicePresets.push("injected");
  assert.equal(getSupertonic3Model("uk", { acceptOpenRailTerms: true }).voicePresets.length, 10);
});

test("pins every model asset to the archived Hugging Face revision", () => {
  const assets = getSupertonic3AssetUrls();
  assert.equal(assets.length, 6);
  assert.ok(assets.every(asset => asset.url.includes(SUPERTONIC3_MODEL.revision)));
  assert.ok(assets.some(asset => asset.path === "onnx/vector_estimator.onnx"));
  assert.ok(assets.some(asset => asset.path === "onnx/vocoder.onnx"));
});

test("accepts supported languages only after license review and rejects unknown ones", () => {
  assert.equal(getSupertonic3Model("de-DE").reason, "license-review-required");
  assert.equal(getSupertonic3Model("de-DE", { acceptOpenRailTerms: true }).available, true);
  assert.equal(getSupertonic3Model("xx").reason, "unsupported-locale");
});

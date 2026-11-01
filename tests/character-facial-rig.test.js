import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCharacterFacialRig,
  validateCharacterFacialRig,
  createCharacterFacialExpression,
  normalizeCharacterFacialExpressions,
  listCharacterFacialExpressions
} from "../src/character-facial-rig.js";
import { normalizeScene } from "../src/scene-model.js";

const bodyRig = { characterId: "fox", bones: [{ id: "root" }, { id: "head", parentId: "root" }] };
const facialRig = () => ({
  schemaVersion: 1,
  characterId: "fox",
  headBoneId: "head",
  parts: [
    { id: "eye-l", role: "eye-left", imageUrl: "https://cdn.example.test/eye-l.png" },
    { id: "mouth", role: "mouth", imageUrl: "blob:mouth-asset" }
  ]
});

test("normalizes bounded facial rig parts and validates matching head bone", () => {
  const normalized = normalizeCharacterFacialRig(facialRig());
  assert.equal(normalized.parts.length, 2);
  assert.equal(validateCharacterFacialRig(normalized, bodyRig).status, "valid");
});

test("rejects unresolved head bone, unsupported roles, unsafe URLs and duplicate part IDs", () => {
  const rig = facialRig();
  rig.headBoneId = "missing";
  rig.parts.push({ id: "eye-l", role: "ear", imageUrl: "javascript:alert(1)" });
  const codes = validateCharacterFacialRig(rig, bodyRig).issues.map(issue => issue.code);
  assert.ok(codes.includes("facial-head-bone-unresolved"));
  assert.ok(codes.includes("facial-part-role-invalid"));
  assert.ok(codes.includes("facial-part-image-invalid"));
  assert.ok(codes.includes("facial-part-id-duplicate"));
});

test("provides bounded expression presets without claiming automatic facial rendering", () => {
  assert.deepEqual(listCharacterFacialExpressions(), ["neutral", "blink", "happy", "sad", "surprised", "talk"]);
  const surprised = createCharacterFacialExpression("surprised");
  assert.equal(surprised.expression.mouthShape, "round");
  const bounded = createCharacterFacialExpression("happy", { eyeOpen: 9, mouthOpen: -2, mouthWidth: 8 });
  assert.equal(bounded.expression.eyeOpen, 1);
  assert.equal(bounded.expression.mouthOpen, 0);
  assert.equal(bounded.expression.mouthWidth, 2);
  assert.equal(createCharacterFacialExpression("unknown").status, "unknown-expression");
});

test("persists normalized per-character facial expressions through scene normalization", () => {
  const expressions = normalizeCharacterFacialExpressions({
    fox: { name: "happy", eyeOpen: 2, mouthOpen: 0.4 },
    ignored: null
  });
  assert.equal(expressions.fox.eyeOpen, 1);
  assert.equal(expressions.fox.mouthOpen, 0.4);
  const scene = normalizeScene({ characterFacialExpressions: { fox: { name: "blink" } } });
  assert.equal(scene.characterFacialExpressions.fox.name, "blink");
  assert.equal(scene.characterFacialExpressions.fox.eyeOpen, 0);
});

test("accepts a clean face-base plate as a supported facial layer", () => {
  const rig = facialRig();
  rig.parts.unshift({ id: "face-base", role: "face-base", imageUrl: "blob:clean-face" });
  assert.equal(validateCharacterFacialRig(rig, bodyRig).status, "valid");
});

test("accepts stable references to persisted local facial assets", () => { const rig=facialRig(); rig.parts[0].imageUrl="dravex-facial-asset://faceasset_123456"; assert.equal(validateCharacterFacialRig(rig,bodyRig).status,"valid"); });

import test from "node:test";
import assert from "node:assert/strict";
import { upsertCharacterFacialPart, applyCharacterFacialExpressionToScene } from "../src/character-facial-editor.js";

const bodyRig = { characterId: "Foxy", bones: [{ id: "root" }, { id: "head", parentId: "root" }] };
const scene = { characterRigs: [bodyRig], characterFacialRigs: [] };
const input = { characterId: "Foxy", headBoneId: "head", partId: "mouth", role: "mouth", imageUrl: "https://assets.example.test/mouth.png", x: 0.5, y: 0.6, width: 0.1, height: 0.06, rotation: 0, zIndex: 12 };

test("adds a validated facial part and preserves the scene body rig", () => {
  const result = upsertCharacterFacialPart(scene, input);
  assert.equal(result.status, "added");
  assert.equal(result.scene.characterRigs[0], bodyRig);
  assert.equal(result.scene.characterFacialRigs[0].parts[0].id, "mouth");
});

test("updates an existing facial part by stable ID without duplicating it", () => {
  const first = upsertCharacterFacialPart(scene, input);
  const updated = upsertCharacterFacialPart(first.scene, { ...input, x: 0.55, imageUrl: "https://assets.example.test/mouth-v2.png" });
  assert.equal(updated.status, "updated");
  assert.equal(updated.scene.characterFacialRigs[0].parts.length, 1);
  assert.equal(updated.scene.characterFacialRigs[0].parts[0].x, 0.55);
});

test("rejects invalid URLs, geometry, and unresolved head bones", () => {
  assert.equal(upsertCharacterFacialPart(scene, { ...input, imageUrl: "javascript:alert(1)" }).status, "invalid");
  assert.equal(upsertCharacterFacialPart(scene, { ...input, x: 3 }).status, "invalid");
  const result = upsertCharacterFacialPart(scene, { ...input, headBoneId: "missing" });
  assert.ok(result.issues.some(issue => issue.code === "facial-head-bone-unresolved"));
});

test("applies bounded facial expression presets to one character", () => {
  const result = applyCharacterFacialExpressionToScene(scene, "Foxy", "happy", { mouthOpen: 8 });
  assert.equal(result.status, "ready");
  assert.equal(result.scene.characterFacialExpressions.Foxy.mouthOpen, 1);
  assert.equal(result.scene.characterFacialExpressions.Foxy.name, "happy");
  assert.equal(applyCharacterFacialExpressionToScene(scene, "Foxy", "unknown").status, "unknown-expression");
});

test("adds an explicit clean face-base plate for mouth replacement", () => {
  const result = upsertCharacterFacialPart(scene, {
    ...input,
    partId: "face-base",
    role: "face-base",
    imageUrl: "blob:clean-face",
    zIndex: -100
  });
  assert.equal(result.status, "added");
  assert.equal(result.scene.characterFacialRigs[0].parts[0].role, "face-base");
});

test("accepts persisted local facial image references", () => { const result=upsertCharacterFacialPart(scene,{...input,imageUrl:"dravex-facial-asset://faceasset_123456"}); assert.equal(result.status,"added"); });

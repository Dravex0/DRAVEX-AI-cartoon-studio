import test from "node:test";
import assert from "node:assert/strict";
import { validateFaceCharacterBinding } from "../src/face-character-binding.js";

test("allows only explicit confirmation for one face in a one-character scene", () => {
  assert.deepEqual(
    validateFaceCharacterBinding({
      sceneCharacterIds: ["Fox"],
      detectedFaceCount: 1,
      confirmedCharacterId: "fox",
      userConfirmed: true
    }),
    {
      allowed: true,
      status: "explicit-single-character-binding",
      characterId: "Fox",
      detectedFaceCount: 1,
      identityTracked: false
    }
  );
});

test("refuses scenes with multiple characters even when one is selected", () => {
  const result = validateFaceCharacterBinding({
    sceneCharacterIds: ["Fox", "Rabbit"],
    detectedFaceCount: 1,
    confirmedCharacterId: "Fox",
    userConfirmed: true
  });
  assert.equal(result.allowed, false);
  assert.equal(result.status, "multiple-scene-characters");
});

test("refuses multiple detected faces", () => {
  const result = validateFaceCharacterBinding({
    sceneCharacterIds: ["Fox"],
    detectedFaceCount: 2,
    confirmedCharacterId: "Fox",
    userConfirmed: true
  });
  assert.equal(result.allowed, false);
  assert.equal(result.status, "multiple-faces");
});

test("requires an explicit matching character selection", () => {
  assert.equal(validateFaceCharacterBinding({
    sceneCharacterIds: ["Fox"], detectedFaceCount: 1, userConfirmed: true
  }).status, "character-not-selected");
  assert.equal(validateFaceCharacterBinding({
    sceneCharacterIds: ["Fox"], detectedFaceCount: 1,
    confirmedCharacterId: "Rabbit", userConfirmed: true
  }).status, "character-not-selected");
});

test("requires a separate user confirmation", () => {
  const result = validateFaceCharacterBinding({
    sceneCharacterIds: ["Fox"],
    detectedFaceCount: 1,
    confirmedCharacterId: "Fox"
  });
  assert.equal(result.allowed, false);
  assert.equal(result.status, "user-confirmation-required");
});

test("fails closed for no face, no character, and invalid counts", () => {
  assert.equal(validateFaceCharacterBinding({
    sceneCharacterIds: ["Fox"], detectedFaceCount: 0,
    confirmedCharacterId: "Fox", userConfirmed: true
  }).status, "no-face");
  assert.equal(validateFaceCharacterBinding({detectedFaceCount:1}).status, "no-scene-character");
  assert.equal(validateFaceCharacterBinding({
    sceneCharacterIds:["Fox"],detectedFaceCount:1.5,
    confirmedCharacterId:"Fox",userConfirmed:true
  }).status, "invalid-face-count");
});

test("deduplicates repeated character IDs without making a multi-character scene ambiguous", () => {
  const result = validateFaceCharacterBinding({
    sceneCharacterIds: ["Fox", " fox "],
    detectedFaceCount: 1,
    confirmedCharacterId: "Fox",
    userConfirmed: true
  });
  assert.equal(result.allowed, true);
});

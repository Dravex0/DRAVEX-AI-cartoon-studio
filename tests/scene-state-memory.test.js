import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSceneStateMemory,
  validateSceneStateContinuity
} from "../src/scene-state-memory.js";

function scene(id, startState, endState, stateChanges = [], storyDetail = "") {
  return { id, characters: ["Mira"], startState, endState, stateChanges, storyDetail };
}

function state({ characterLocation = "village", objectOwner = "Mira", objectState = "held" } = {}) {
  return {
    characters: { Mira: { location: characterLocation } },
    objects: { key: { owner: objectOwner, state: objectState } }
  };
}

test("flags unexplained character teleportation", () => {
  const memory = buildSceneStateMemory([
    scene("s1", state(), state()),
    scene("s2", state({ characterLocation: "castle" }), state({ characterLocation: "castle" }))
  ]);
  const report = validateSceneStateContinuity(memory);
  assert.equal(report.passed, false);
  assert.ok(report.issues.some(issue => issue.code === "character-teleportation"));
});

test("flags an explicitly marked object disappearance without evidence", () => {
  const memory = buildSceneStateMemory([
    scene("s1", state(), state()),
    scene("s2", state({ objectState: "missing" }), state({ objectState: "missing" }))
  ]);
  const report = validateSceneStateContinuity(memory);
  assert.ok(report.issues.some(issue => issue.code === "object-disappearance-unexplained"));
});

test("flags unexplained object owner changes", () => {
  const memory = buildSceneStateMemory([
    scene("s1", state(), state()),
    scene("s2", state({ objectOwner: "Niko" }), state({ objectOwner: "Niko" }))
  ]);
  const report = validateSceneStateContinuity(memory);
  assert.ok(report.issues.some(issue => issue.code === "object-owner-change-unexplained"));
});

test("accepts an exact evidence-backed state change", () => {
  const memory = buildSceneStateMemory([
    scene("s1", state(), state()),
    scene("s2", state({ characterLocation: "castle" }), state({ characterLocation: "castle" }), [
      { entity: "Mira", property: "location", previousValue: "village",
        value: "castle", evidence: "Mira travels from the village to the castle." }
    ], "Mira travels from the village to the castle.")
  ]);
  const report = validateSceneStateContinuity(memory);
  assert.equal(report.passed, true);
  assert.deepEqual(report.issues, []);
});

test("accepts a source-backed clothing change between scenes", () => {
  const previous = state();
  previous.characters.Mira.clothing = "blue coat";
  const next = state();
  next.characters.Mira.clothing = "red dress";
  const memory = buildSceneStateMemory([
    scene("s1", previous, previous),
    scene("s2", next, next, [
      { entity: "Mira", property: "clothing", previousValue: "blue coat",
        value: "red dress", evidence: "Mira changes into a red dress." }
    ], "Mira changes into a red dress.")
  ]);
  const report = validateSceneStateContinuity(memory);
  assert.equal(report.passed, true);
  assert.deepEqual(report.issues, []);
});

test("null and omitted values remain unknown rather than deletion", () => {
  const memory = buildSceneStateMemory([
    scene("s1", state(), state()),
    scene("s2", { characters: { Mira: { location: null } }, objects: {} },
      { characters: { Mira: { location: null } }, objects: {} })
  ]);
  const report = validateSceneStateContinuity(memory);
  assert.equal(report.passed, true);
  assert.deepEqual(report.issues, []);
});

test("empty memories are valid and malformed memories fail closed", () => {
  const empty = buildSceneStateMemory([]);
  assert.deepEqual(validateSceneStateContinuity(empty), {
    passed: true, checkedTransitions: 0, issues: []
  });
  assert.equal(validateSceneStateContinuity({ schemaVersion: 1, sceneCount: 1, scenes: [] }).passed, false);
});

test("duplicate scene and entity IDs are rejected by the strict contract", () => {
  assert.equal(buildSceneStateMemory([scene("same", state(), state()), scene("same", state(), state())]), null);
  assert.equal(buildSceneStateMemory([
    { id: "bad", characters: ["Mira", "Mira"], startState: state(), endState: state() }
  ]), null);
});


test("hostile memory getters fail closed without throwing", () => {
  const hostile = {};
  Object.defineProperty(hostile, "schemaVersion", {
    get() { throw new Error("hostile memory"); }
  });
  assert.doesNotThrow(() => validateSceneStateContinuity(hostile));
  assert.equal(validateSceneStateContinuity(hostile).passed, false);
});

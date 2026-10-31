import test from "node:test";
import assert from "node:assert/strict";
import { ensureSceneIds } from "../src/scene-identity.js";

test("assigns IDs to scenes that do not have one", () => {
  let next = 0;
  const scenes = [{ title: "A" }, { title: "B", id: "scene-b" }];
  ensureSceneIds(scenes, () => `generated-${++next}`);
  assert.equal(scenes[0].id, "generated-1");
  assert.equal(scenes[1].id, "scene-b");
});

test("preserves IDs across deletion and reordering", () => {
  const scenes = [{ id: "scene-a" }, { id: "scene-b" }, { id: "scene-c" }];
  ensureSceneIds(scenes);
  const remaining = [scenes[2], scenes[0]];
  ensureSceneIds(remaining);
  assert.deepEqual(remaining.map(scene => scene.id), ["scene-c", "scene-a"]);
});

test("replaces duplicate IDs while preserving the first occurrence", () => {
  let next = 0;
  const scenes = [{ id: "duplicate" }, { id: "duplicate" }, {}];
  ensureSceneIds(scenes, () => `unique-${++next}`);
  assert.equal(scenes[0].id, "duplicate");
  assert.equal(scenes[1].id, "unique-1");
  assert.equal(scenes[2].id, "unique-2");
  assert.equal(new Set(scenes.map(scene => scene.id)).size, 3);
});

test("handles invalid collections without throwing", () => {
  assert.deepEqual(ensureSceneIds(null), []);
  assert.deepEqual(ensureSceneIds("not scenes"), []);
});

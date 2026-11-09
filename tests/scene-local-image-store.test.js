import test from "node:test";
import assert from "node:assert/strict";
import { createSceneLocalImageStore } from "../src/scene-local-image-store.js";

test("keeps local scene images isolated by stable scene ID", () => {
  const store = createSceneLocalImageStore();
  const firstSceneImage = new Blob(["scene one"], { type: "image/png" });
  const secondSceneImage = new Blob(["scene two"], { type: "image/jpeg" });

  store.set("scene-1", firstSceneImage);
  store.set("scene-2", secondSceneImage);

  assert.equal(store.get("scene-1"), firstSceneImage);
  assert.equal(store.get("scene-2"), secondSceneImage);
  assert.notEqual(store.get("scene-1"), store.get("scene-2"));
  assert.equal(store.get("scene-3"), null);
});

test("replacing or clearing a scene image affects only that scene", () => {
  const store = createSceneLocalImageStore();
  const original = new Blob(["original"], { type: "image/png" });
  const replacement = new Blob(["replacement"], { type: "image/webp" });
  const otherScene = new Blob(["other"], { type: "image/jpeg" });

  store.set("scene-1", original);
  store.set("scene-2", otherScene);
  store.set("scene-1", replacement);

  assert.equal(store.get("scene-1"), replacement);
  assert.equal(store.get("scene-2"), otherScene);

  store.set("scene-1", null);
  assert.equal(store.get("scene-1"), null);
  assert.equal(store.get("scene-2"), otherScene);
});

test("rejects missing scene IDs and non-Blob-like values", () => {
  const store = createSceneLocalImageStore();

  assert.throws(() => store.set("", new Blob(["x"], { type: "image/png" })), /stable scene ID/);
  assert.throws(() => store.set("scene-1", "not an image"), /File or Blob/);
});

test("retains only images belonging to scenes still in the storyboard", () => {
  const store = createSceneLocalImageStore();
  store.set("scene-1", new Blob(["one"], { type: "image/png" }));
  store.set("scene-2", new Blob(["two"], { type: "image/png" }));
  store.set("scene-3", new Blob(["three"], { type: "image/png" }));

  assert.equal(store.retain(["scene-1", "scene-3"]), 2);
  assert.equal(store.get("scene-1")?.size, 3);
  assert.equal(store.get("scene-2"), null);
  assert.equal(store.get("scene-3")?.size, 5);
});

test("deletes one scene image and can clear all tab-local references", () => {
  const store = createSceneLocalImageStore();
  store.set("scene-1", new Blob(["one"], { type: "image/png" }));
  store.set("scene-2", new Blob(["two"], { type: "image/png" }));

  assert.equal(store.delete("scene-1"), true);
  assert.equal(store.get("scene-1"), null);
  assert.equal(store.size, 1);

  store.clear();
  assert.equal(store.size, 0);
  assert.equal(store.get("scene-2"), null);
});

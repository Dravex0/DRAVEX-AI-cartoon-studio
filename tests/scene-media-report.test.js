import test from "node:test";
import assert from "node:assert/strict";
import { buildSceneMediaReport } from "../src/scene-media-report.js";

test("counts only scene IDs backed by decoded video cache entries", () => {
  const scenes = [{ id: "a", title: "Opening" }, { id: "b", title: "Chase" }, { id: "c", title: "Ending" }];
  const report = buildSceneMediaReport(scenes, new Set(["b"]));
  assert.equal(report.totalScenes, 3);
  assert.equal(report.videoScenes, 1);
  assert.equal(report.stillScenes, 2);
  assert.equal(report.complete, false);
  assert.deepEqual(report.items.map(item => item.mediaType), ["still", "video", "still"]);
});

test("marks a film complete only when every scene has a video clip", () => {
  const report = buildSceneMediaReport([{ id: "a" }, { id: "b" }], ["a", "b"]);
  assert.equal(report.videoScenes, 2);
  assert.equal(report.stillScenes, 0);
  assert.equal(report.complete, true);
});

test("does not count missing IDs as generated video", () => {
  const report = buildSceneMediaReport([{ title: "No ID" }, { id: "a" }], ["", "a"]);
  assert.equal(report.videoScenes, 1);
  assert.equal(report.stillScenes, 1);
});

test("validates the scenes input", () => {
  assert.throws(() => buildSceneMediaReport(null), /array/);
});

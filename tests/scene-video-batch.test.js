import test from "node:test";
import assert from "node:assert/strict";
import { generateStoryboardVideos } from "../src/scene-video-batch.js";

test("generates scenes sequentially and reports real completion counts", async () => {
  const order = [];
  const progress = [];
  const report = await generateStoryboardVideos({
    scenes: [{ id: "a" }, { id: "b" }, { id: "c" }],
    generateScene: async scene => {
      order.push(scene.id);
      return { status: "completed", video: new Blob(["clip"]) };
    },
    onProgress: value => progress.push({ stage: value.stage, completed: value.completed })
  });

  assert.deepEqual(order, ["a", "b", "c"]);
  assert.equal(report.completed, 3);
  assert.equal(report.failed, 0);
  assert.equal(report.total, 3);
  assert.ok(progress.some(value => value.stage === "completed" && value.completed === 3));
});

test("skips already generated clips without calling the provider", async () => {
  let calls = 0;
  const report = await generateStoryboardVideos({
    scenes: [{ id: "a" }, { id: "b" }],
    hasVideo: scene => scene.id === "a",
    generateScene: async () => {
      calls += 1;
      return { status: "completed" };
    }
  });

  assert.equal(calls, 1);
  assert.equal(report.skipped, 1);
  assert.equal(report.completed, 1);
});

test("continues after a scene failure and reports it", async () => {
  const report = await generateStoryboardVideos({
    scenes: [{ id: "bad" }, { id: "good" }],
    generateScene: async scene => {
      if (scene.id === "bad") throw new Error("provider unavailable");
      return { status: "completed" };
    }
  });

  assert.equal(report.failed, 1);
  assert.equal(report.completed, 1);
  assert.equal(report.results[0].error, "provider unavailable");
});

test("stops before starting work when the signal is aborted", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const report = await generateStoryboardVideos({
    scenes: [{ id: "a" }],
    generateScene: async () => {
      calls += 1;
      return { status: "completed" };
    },
    signal: controller.signal
  });

  assert.equal(calls, 0);
  assert.equal(report.cancelled, true);
});


test("normalizes provider progress fractions and percentages without inventing progress", async () => {
  const { normalizeVideoProgressPercent, readVideoProgressPercent } =
    await import("../src/scene-video-batch.js");

  assert.equal(normalizeVideoProgressPercent(0.5), 50);
  assert.equal(normalizeVideoProgressPercent(42), 42);
  assert.equal(normalizeVideoProgressPercent(-2), 0);
  assert.equal(normalizeVideoProgressPercent(140), 100);
  assert.equal(normalizeVideoProgressPercent(Number.NaN), null);
  assert.equal(readVideoProgressPercent({ stage: "queued", queuePosition: 3 }), null);
  assert.equal(readVideoProgressPercent({ progress_data: [{ progress: 0.5 }] }), 50);
  assert.equal(readVideoProgressPercent({ progressPercent: 73 }), 73);
  assert.equal(readVideoProgressPercent({ progress: [{ progress: 0.25 }] }), 25);
});

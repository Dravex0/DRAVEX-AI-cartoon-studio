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
      return { status: "completed", video: new Blob(["clip"], { type: "video/webm" }) };
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
      return { status: "completed", video: new Blob(["clip"], { type: "video/webm" }) };
    }
  });

  assert.equal(calls, 1);
  assert.equal(report.skipped, 1);
  assert.equal(report.completed, 1);
});

test("rejects provider completion when the video artifact is missing or empty", async () => {
  for (const video of [undefined, new Blob([]), new Blob(["not a video"], { type: "text/plain" })]) {
    const report = await generateStoryboardVideos({
      scenes: [{ id: "invalid" }],
      generateScene: async () => ({ status: "completed", video })
    });
    assert.equal(report.completed, 0);
    assert.equal(report.failed, 1);
    assert.match(report.results[0].error, /non-empty video artifact|no video MIME type/);
  }
});

test("continues after a scene failure and reports it", async () => {
  const report = await generateStoryboardVideos({
    scenes: [{ id: "bad" }, { id: "good" }],
    generateScene: async scene => {
      if (scene.id === "bad") throw new Error("provider unavailable");
      return { status: "completed", video: new Blob(["clip"], { type: "video/webm" }) };
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

test("isolates progress callback errors from scene generation", async () => {
  const generated = [];
  const report = await generateStoryboardVideos({
    scenes: [{ id: "cached" }, { id: "bad" }, { id: "good" }],
    hasVideo: scene => scene.id === "cached",
    generateScene: async scene => {
      generated.push(scene.id);
      if (scene.id === "bad") throw new Error("provider unavailable");
      return { status: "completed", video: new Blob(["clip"], { type: "video/webm" }) };
    },
    onProgress: state => {
      throw new Error("UI progress failed: " + state.stage);
    }
  });

  assert.deepEqual(generated, ["bad", "good"]);
  assert.equal(report.skipped, 1);
  assert.equal(report.failed, 1);
  assert.equal(report.completed, 1);
  assert.deepEqual(report.results.map(result => result.status), ["skipped", "failed", "completed"]);
  assert.deepEqual(report.progressErrors.map(item => [item.index, item.stage, item.error]), [
    [0, "skipped", "UI progress failed: skipped"],
    [1, "starting", "UI progress failed: starting"],
    [1, "failed", "UI progress failed: failed"],
    [2, "starting", "UI progress failed: starting"],
    [2, "completed", "UI progress failed: completed"]
  ]);
});


test("passes the last successfully generated scene to the next scene as continuity context", async () => {
  const received = [];
  const scenes = [{ id: "a", endState: "Kel holds the key" }, { id: "b" }, { id: "c" }];
  const report = await generateStoryboardVideos({
    scenes,
    generateScene: async (scene, index, context) => {
      received.push({
        id: scene.id,
        previousSceneId: context.previousScene?.id ?? null,
        previousResult: context.previousResult?.video ?? null,
        continuity: context.continuity
      });
      if (scene.id === "b") throw new Error("temporary provider failure");
      return {
        status: "completed",
        video: new Blob([scene.id], { type: "video/webm" })
      };
    }
  });

  assert.equal(report.completed, 2);
  assert.equal(report.failed, 1);
  assert.deepEqual(received.map(item => item.id), ["a", "b", "c"]);
  assert.equal(received[0].previousSceneId, null);
  assert.equal(received[0].continuity.available, false);
  assert.equal(received[1].previousSceneId, "a");
  assert.equal(received[1].previousResult.size, 1);
  assert.deepEqual(received[1].continuity, { available: true, sourceSceneId: "a" });
  // A failed scene must not replace the last valid continuity source.
  assert.equal(received[2].previousSceneId, "a");
  assert.equal(received[2].previousResult.size, 1);
});


test("uses a cached previous clip as continuity context after skipping a generated scene", async () => {
  const cachedVideo = new Blob(["cached"], { type: "video/webm" });
  const received = [];
  const report = await generateStoryboardVideos({
    scenes: [{ id: "cached-scene" }, { id: "next-scene" }],
    hasVideo: scene => scene.id === "cached-scene",
    getCachedResult: async scene => scene.id === "cached-scene"
      ? { status: "completed", video: cachedVideo }
      : null,
    generateScene: async (scene, index, context) => {
      received.push({
        previousSceneId: context.previousScene?.id ?? null,
        previousVideo: context.previousResult?.video ?? null,
        continuity: context.continuity
      });
      return { status: "completed", video: new Blob(["next"], { type: "video/webm" }) };
    }
  });

  assert.equal(report.skipped, 1);
  assert.equal(report.completed, 1);
  assert.equal(received.length, 1);
  assert.equal(received[0].previousSceneId, "cached-scene");
  assert.equal(received[0].previousVideo, cachedVideo);
  assert.deepEqual(received[0].continuity, { available: true, sourceSceneId: "cached-scene" });
});

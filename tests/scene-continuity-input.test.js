import test from "node:test";
import assert from "node:assert/strict";
import { prepareSceneContinuityInput } from "../src/scene-continuity-input.js";

test("uses the previous scene final frame and preserves scene-state instructions", async () => {
  const scenes = [
    { id: "scene-a", endState: "Kel frees the bird" },
    { id: "scene-b", startState: "Kel watches the bird fly away" }
  ];
  const previousVideo = new Blob(["previous clip"], { type: "video/webm" });
  const finalFrame = new Blob(["png frame"], { type: "image/png" });
  const calls = [];
  const result = await prepareSceneContinuityInput({
    mode: "huggingface",
    taskType: "image-to-video",
    index: 1,
    scenes,
    previousScene: scenes[0],
    previousResult: { status: "completed", video: previousVideo },
    imageInput: new Blob(["initial image"], { type: "image/png" }),
    prompt: "Kel remains in the forest.",
    extractLastFrame: async (video, options) => {
      calls.push({ video, options });
      return finalFrame;
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].video, previousVideo);
  assert.equal(result.imageInput, finalFrame);
  assert.equal(result.continuityFrameUsed, true);
  assert.equal(result.continuitySourceSceneId, "scene-a");
  assert.match(result.prompt, /exact final decoded frame/);
  assert.match(result.prompt, /Kel frees the bird/);
  assert.match(result.prompt, /Kel watches the bird fly away/);
});

test("does not apply image continuity to other providers or task types", async () => {
  let calls = 0;
  const scenes = [{ id: "a" }, { id: "b" }];
  const imageInput = new Blob(["source"], { type: "image/png" });
  const args = {
    taskType: "image-to-video",
    index: 1,
    scenes,
    previousScene: scenes[0],
    previousResult: { video: new Blob(["clip"], { type: "video/webm" }) },
    imageInput,
    prompt: "Move.",
    extractLastFrame: async () => { calls += 1; return new Blob(["frame"], { type: "image/png" }); }
  };

  for (const overrides of [
    { mode: "comfyui" },
    { mode: "huggingface", taskType: "text-to-video" },
    { mode: "huggingface", index: 0 }
  ]) {
    const result = await prepareSceneContinuityInput({ mode: "huggingface", ...args, ...overrides });
    assert.equal(result.imageInput, imageInput);
    assert.equal(result.continuityFrameUsed, false);
  }
  assert.equal(calls, 0);
});

test("does not use a non-adjacent or missing previous clip", async () => {
  const scenes = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const video = new Blob(["clip"], { type: "video/webm" });
  const imageInput = new Blob(["source"], { type: "image/png" });
  let calls = 0;
  const common = {
    mode: "huggingface",
    taskType: "image-to-video",
    index: 2,
    scenes,
    previousResult: { video },
    imageInput,
    extractLastFrame: async () => { calls += 1; return new Blob(["frame"], { type: "image/png" }); }
  };

  const nonAdjacent = await prepareSceneContinuityInput({ ...common, previousScene: scenes[0] });
  const missingClip = await prepareSceneContinuityInput({
    ...common, previousScene: scenes[1], previousResult: null
  });
  assert.equal(nonAdjacent.continuityFrameUsed, false);
  assert.equal(missingClip.continuityFrameUsed, false);
  assert.equal(calls, 0);
});

test("rejects invalid extracted frames instead of silently sending the old image", async () => {
  const scenes = [{ id: "a" }, { id: "b" }];
  await assert.rejects(
    prepareSceneContinuityInput({
      mode: "huggingface",
      taskType: "image-to-video",
      index: 1,
      scenes,
      previousScene: scenes[0],
      previousResult: { video: new Blob(["clip"], { type: "video/webm" }) },
      imageInput: new Blob(["source"], { type: "image/png" }),
      extractLastFrame: async () => new Blob(["not an image"], { type: "text/plain" })
    }),
    /valid continuity frame/
  );
});

test("honors cancellation before extracting the previous frame", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const scenes = [{ id: "a" }, { id: "b" }];
  await assert.rejects(
    prepareSceneContinuityInput({
      mode: "huggingface",
      taskType: "image-to-video",
      index: 1,
      scenes,
      previousScene: scenes[0],
      previousResult: { video: new Blob(["clip"], { type: "video/webm" }) },
      signal: controller.signal,
      extractLastFrame: async () => { calls += 1; return new Blob(["frame"], { type: "image/png" }); }
    }),
    error => error.name === "AbortError"
  );
  assert.equal(calls, 0);
});

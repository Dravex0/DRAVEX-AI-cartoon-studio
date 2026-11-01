import test from "node:test";
import assert from "node:assert/strict";
import { createHuggingFaceZeroGPUVideoProvider } from "../src/huggingface-zerogpu-video-provider.js";

function createSubmission(messages) {
  return {
    event_id: "wan-job-1",
    cancelled: false,
    cancel() { this.cancelled = true; },
    async *[Symbol.asyncIterator]() {
      for (const message of messages) yield message;
    }
  };
}

test("submits an image-to-video job with the Wan 2.2 fast profile and downloads MP4", async () => {
  const calls = [];
  const submission = createSubmission([
    { type: "status", stage: "pending", position: 2, eta: 45 },
    { type: "status", stage: "generating", progress_data: [{ progress: 0.5 }] },
    { type: "data", data: [{ url: "https://files.example.test/scene.mp4" }, 123] }
  ]);
  const provider = createHuggingFaceZeroGPUVideoProvider({
    client: { submit: (...args) => { calls.push(args); return submission; } },
    handleFile: blob => ({ fileBlob: blob }),
    fetchImpl: async url => {
      assert.equal(url, "https://files.example.test/scene.mp4");
      return { ok: true, blob: async () => new Blob(["mp4"], { type: "video/mp4" }) };
    }
  });
  const progress = [];
  const image = new Blob(["png"], { type: "image/png" });
  const result = await provider.generate({
    taskType: "image-to-video",
    prompt: "Anime hero raises a glowing hand",
    negativePrompt: "flicker",
    durationSeconds: 5,
    image
  }, { onProgress: value => progress.push(value) });

  assert.equal(calls[0][0], "/generate_video");
  assert.equal(calls[0][1][0].fileBlob, image);
  assert.equal(calls[0][1][1], "Anime hero raises a glowing hand");
  assert.equal(calls[0][1][2], 4);
  assert.equal(calls[0][1][4], 5);
  assert.equal(calls[0][1][4], 5);
  assert.equal(result.status, "completed");
  assert.equal(result.video.type, "video/mp4");
  assert.equal(result.taskId, "wan-job-1");
  assert.equal(progress[0].queuePosition, 2);
  assert.equal(progress.at(-1).stage, "completed");
});

test("rejects missing images and unsupported task types", async () => {
  const provider = createHuggingFaceZeroGPUVideoProvider({
    client: { submit: () => createSubmission([]) },
    handleFile: value => value
  });
  await assert.rejects(provider.generate({ taskType: "text-to-video", prompt: "x" }), /image-to-video/);
  await assert.rejects(provider.generate({ taskType: "image-to-video", prompt: "x" }), /source image/);
});

test("rejects durations outside the actual Wan 2.2 0.5–5 second range before submitting", async () => {
  let submitCalls = 0;
  const provider = createHuggingFaceZeroGPUVideoProvider({
    client: { submit: () => { submitCalls += 1; return createSubmission([]); } },
    handleFile: value => value
  });
  const image = new Blob(["png"], { type: "image/png" });
  for (const durationSeconds of [0.25, 5.01, 8, 30, Number.NaN]) {
    await assert.rejects(
      provider.generate({ taskType: "image-to-video", prompt: "move", image, durationSeconds }),
      /0.5 to 5 seconds/
    );
  }
  assert.equal(submitCalls, 0);
});

test("cancels a running Gradio job when the signal aborts", async () => {
  let started;
  const submission = {
    cancel() { this.cancelled = true; },
    async *[Symbol.asyncIterator]() {
      started();
      await new Promise(resolve => setTimeout(resolve, 0));
      yield { type: "status", stage: "generating" };
    }
  };
  const provider = createHuggingFaceZeroGPUVideoProvider({
    client: { submit: () => submission },
    handleFile: value => value
  });
  const controller = new AbortController();
  const startedPromise = new Promise(resolve => { started = resolve; });
  const pending = provider.generate({
    taskType: "image-to-video",
    prompt: "move",
    image: new Blob(["png"])
  }, { signal: controller.signal });
  await startedPromise;
  controller.abort();
  await assert.rejects(pending, error => error.name === "AbortError");
  assert.equal(submission.cancelled, true);
});

test("rejects invalid or non-video provider output", async () => {
  const provider = createHuggingFaceZeroGPUVideoProvider({
    client: { submit: () => createSubmission([{ type: "data", data: ["not-a-url"] }]) },
    handleFile: value => value
  });
  await assert.rejects(provider.generate({
    taskType: "image-to-video",
    prompt: "move",
    image: new Blob(["png"])
  }), /HTTPS video URL/);
});

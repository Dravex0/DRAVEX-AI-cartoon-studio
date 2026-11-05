import test from "node:test";
import assert from "node:assert/strict";
import { analyzeFaceVideoFrames } from "../src/face-video-analysis.js";

function makeFrame() {
  return { closeCount: 0, close() { this.closeCount += 1; } };
}

function makeClient(results = []) {
  const calls = [];
  let disposed = false;
  return {
    calls,
    get isDisposed() { return disposed; },
    disposeClient() { disposed = true; },
    async processFrame(frame, timestampMs) {
      calls.push({ frame, timestampMs });
      const result = results.length ? results.shift() : { status: "no-face" };
      if (result instanceof Error) throw result;
      return result;
    }
  };
}

test("analyzes frames sequentially and reports progress and checkpoints", async () => {
  const client = makeClient([
    { status: "face-detected" },
    { status: "no-face" },
    { status: "face-detected" }
  ]);
  const frames = [];
  const progress = [];
  const checkpoints = [];
  const report = await analyzeFaceVideoFrames({
    durationMs: 1200,
    sampleIntervalMs: 500,
    captureFrame: async timestampMs => {
      const frame = makeFrame();
      frames.push({ timestampMs, frame });
      return frame;
    },
    workerClient: client,
    onProgress: value => progress.push(value),
    onCheckpoint: value => checkpoints.push(value)
  });

  assert.equal(report.status, "completed");
  assert.equal(report.total, 3);
  assert.equal(report.processed, 3);
  assert.equal(report.detected, 2);
  assert.equal(report.noFace, 1);
  assert.deepEqual(client.calls.map(call => call.timestampMs), [0, 500, 1000]);
  assert.deepEqual(frames.map(item => item.frame.closeCount), [1, 1, 1]);
  assert.equal(progress.length, 3);
  assert.equal(progress[2].percent, 100);
  assert.equal(checkpoints[2].nextTimestampMs, 1500);
});

test("supports resuming from a checkpoint timestamp", async () => {
  const client = makeClient();
  const timestamps = [];
  const report = await analyzeFaceVideoFrames({
    durationMs: 3000,
    sampleIntervalMs: 500,
    startTimeMs: 1500,
    captureFrame: async timestampMs => {
      timestamps.push(timestampMs);
      return makeFrame();
    },
    workerClient: client
  });
  assert.equal(report.total, 3);
  assert.deepEqual(timestamps, [1500, 2000, 2500]);
  assert.equal(report.lastTimestampMs, 2500);
});

test("cancellation stops before capturing the next frame", async () => {
  const controller = new AbortController();
  const client = makeClient();
  const timestamps = [];
  const report = await analyzeFaceVideoFrames({
    durationMs: 3000,
    sampleIntervalMs: 500,
    captureFrame: async timestampMs => {
      timestamps.push(timestampMs);
      if (timestampMs === 500) controller.abort();
      return makeFrame();
    },
    workerClient: client,
    signal: controller.signal
  });
  assert.equal(report.status, "cancelled");
  assert.equal(report.cancelled, true);
  assert.deepEqual(timestamps, [0, 500]);
  assert.equal(report.processed, 1);
});

test("capture errors are recorded and later frames continue", async () => {
  const client = makeClient();
  const report = await analyzeFaceVideoFrames({
    durationMs: 1000,
    sampleIntervalMs: 500,
    captureFrame: async timestampMs => {
      if (timestampMs === 0) throw new Error("decode failed");
      return makeFrame();
    },
    workerClient: client
  });
  assert.equal(report.status, "completed-with-errors");
  assert.equal(report.failed, 1);
  assert.equal(report.processed, 1);
  assert.equal(report.errors[0].message, "decode failed");
});

test("worker failures are counted and a disposed worker stops the batch", async () => {
  const client = makeClient([new Error("worker crashed")]);
  const frames = [];
  client.processFrame = async (frame, timestampMs) => {
    frames.push(timestampMs);
    client.disposeClient();
    throw new Error("worker crashed");
  };
  const report = await analyzeFaceVideoFrames({
    durationMs: 2000,
    sampleIntervalMs: 500,
    captureFrame: async () => makeFrame(),
    workerClient: client
  });
  assert.equal(report.status, "worker-unavailable");
  assert.equal(report.failed, 1);
  assert.deepEqual(frames, [0]);
});

test("closes a captured frame when cancellation occurs before transfer", async () => {
  const controller = new AbortController();
  const frame = makeFrame();
  const client = makeClient();
  const reportPromise = analyzeFaceVideoFrames({
    durationMs: 1000,
    captureFrame: async () => {
      controller.abort();
      return frame;
    },
    workerClient: client,
    signal: controller.signal
  });
  const report = await reportPromise;
  assert.equal(report.status, "cancelled");
  assert.equal(frame.closeCount, 1);
  assert.equal(client.calls.length, 0);
});

test("rejects invalid bounds and excessive frame counts before processing", async () => {
  const client = makeClient();
  const captureFrame = async () => makeFrame();
  await assert.rejects(analyzeFaceVideoFrames({
    durationMs: 0, captureFrame, workerClient: client
  }), /durationMs/);
  await assert.rejects(analyzeFaceVideoFrames({
    durationMs: 5000, sampleIntervalMs: 100, maxFrames: 10, captureFrame, workerClient: client
  }), /exceeding maxFrames/);
  assert.equal(client.calls.length, 0);
});

test("invalid capture results are counted without crashing the analysis", async () => {
  const client = makeClient();
  const report = await analyzeFaceVideoFrames({
    durationMs: 500,
    captureFrame: async () => ({ notABitmap: true }),
    workerClient: client
  });
  assert.equal(report.status, "completed-with-errors");
  assert.equal(report.failed, 1);
  assert.match(report.errors[0].message, /ImageBitmap/);
  assert.equal(client.calls.length, 0);
});


test("publishes face landmarks from each detected frame", async () => {
  const client = makeClient([
    { status: "face-detected", faceCount: 1, anchors: { mouthCenter: { x: 0.5, y: 0.6 }, mouthOpenRatio: 0.2 } },
    { status: "no-face", faceCount: 0, anchors: null }
  ]);
  const results = [];
  const report = await analyzeFaceVideoFrames({
    durationMs: 1000,
    sampleIntervalMs: 500,
    captureFrame: async () => makeFrame(),
    workerClient: client,
    onFrameResult: result => results.push(result)
  });
  assert.equal(report.detected, 1);
  assert.equal(results.length, 2);
  assert.deepEqual(results[0].anchors.mouthCenter, { x: 0.5, y: 0.6 });
  assert.equal(results[0].status, "face-detected");
  assert.equal(results[1].status, "no-face");
});

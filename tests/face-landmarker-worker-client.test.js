import test from "node:test";
import assert from "node:assert/strict";
import { createFaceLandmarkerWorkerClient, FACE_LANDMARKER_RUNTIME_VERSION } from "../src/face-landmarker-worker-client.js";

class FakeWorker {
  constructor() { this.messages = []; this.terminated = false; }
  postMessage(message, transfer = []) {
    this.messages.push({ message, transfer });
    queueMicrotask(() => {
      if (this.terminated) return;
      const result = message.type === "initialize"
        ? { status: "ready", version: FACE_LANDMARKER_RUNTIME_VERSION }
        : message.type === "process-frame"
          ? { status: "no-face", faceCount: 0, anchors: null, timestampMs: message.timestampMs }
          : { status: "disposed" };
      this.onmessage?.({ data: { id: message.id, ok: true, result } });
    });
  }
  terminate() { this.terminated = true; }
}
const makeFrame = () => ({ width: 16, height: 16, close() {} });

test("initializes a worker lazily and defaults to CPU", async () => {
  const worker = new FakeWorker();
  const client = createFaceLandmarkerWorkerClient({ workerFactory: () => worker });
  const result = await client.initialize();
  assert.equal(result.status, "ready");
  assert.equal(worker.messages[0].message.delegate, "CPU");
  await client.dispose();
  assert.equal(worker.terminated, true);
});

test("transfers one frame at a time and preserves monotonic timestamps", async () => {
  const worker = new FakeWorker();
  const client = createFaceLandmarkerWorkerClient({ workerFactory: () => worker });
  await client.initialize();
  const frame = makeFrame();
  const result = await client.processFrame(frame, 100);
  assert.equal(result.status, "no-face");
  assert.deepEqual(worker.messages[1].transfer, [frame]);
  await assert.rejects(client.processFrame(makeFrame(), 100), /monotonically/);
  await assert.rejects(client.processFrame(makeFrame(), 99), /monotonically/);
  const next = await client.processFrame(makeFrame(), 140);
  assert.equal(next.timestampMs, 140);
  await client.dispose();
});

test("rejects invalid frame inputs without posting them", async () => {
  const worker = new FakeWorker();
  const client = createFaceLandmarkerWorkerClient({ workerFactory: () => worker });
  await assert.rejects(client.processFrame(null, 10), /ImageBitmap/);
  await assert.rejects(client.processFrame(makeFrame(), -1), /ImageBitmap/);
  assert.equal(worker.messages.length, 0);
  await client.dispose();
});

test("does not allow concurrent requests", async () => {
  let resolveMessage;
  const worker = new FakeWorker();
  worker.postMessage = message => {
    worker.messages.push(message);
    if (message.type === "dispose") {
      queueMicrotask(() => worker.onmessage?.({ data: { id: message.id, ok: true, result: { status: "disposed" } } }));
    } else {
      resolveMessage = () => worker.onmessage?.({ data: { id: message.id, ok: true, result: { status: "ready" } } });
    }
  };
  const client = createFaceLandmarkerWorkerClient({ workerFactory: () => worker });
  const first = client.initialize();
  await assert.rejects(client.initialize(), /already running/);
  resolveMessage();
  await first;
  await client.dispose();
});

test("terminates cleanly and rejects future work after disposal", async () => {
  const worker = new FakeWorker();
  const client = createFaceLandmarkerWorkerClient({ workerFactory: () => worker });
  await client.dispose();
  assert.equal(client.isDisposed, true);
  assert.equal(worker.terminated, true);
  await assert.rejects(client.initialize(), /disposed/);
});

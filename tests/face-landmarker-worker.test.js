import test from "node:test";
import assert from "node:assert/strict";

test("face landmark worker validates messages and always closes rejected frames", async () => {
  const originalSelf = globalThis.self;
  const messages = [];
  let messageHandler;
  globalThis.self = {
    postMessage(message) { messages.push(message); },
    addEventListener(type, handler) {
      assert.equal(type, "message");
      messageHandler = handler;
    }
  };

  try {
    await import("../src/face-landmarker.worker.js?worker-protocol-test");
    assert.equal(typeof messageHandler, "function");

    messageHandler({ data: { id: 1, type: "unknown" } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(messages.at(-1).id, 1);
    assert.equal(messages.at(-1).ok, false);
    assert.match(messages.at(-1).error.message, /Unknown face landmark worker message/);

    const frame = { closed: 0, close() { this.closed += 1; } };
    messageHandler({ data: { id: 2, type: "process-frame", frame, timestampMs: 0 } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(frame.closed, 1);
    assert.equal(messages.at(-1).id, 2);
    assert.equal(messages.at(-1).ok, false);
    assert.match(messages.at(-1).error.message, /not initialized/);

    messageHandler({ data: { id: 3, type: "initialize", delegate: "NPU" } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(messages.at(-1).id, 3);
    assert.equal(messages.at(-1).ok, false);
    assert.match(messages.at(-1).error.message, /Unsupported MediaPipe delegate/);

    messageHandler({ data: { id: 4, type: "dispose" } });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(messages.at(-1), { id: 4, ok: true, result: { status: "disposed" } });
  } finally {
    if (originalSelf === undefined) delete globalThis.self;
    else globalThis.self = originalSelf;
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { emitProgressSafely } from "../src/progress-callback.js";

test("reports synchronous observer errors without throwing into the caller", () => {
  const payload = { phase: "generating", sceneIndex: 2 };
  const errors = [];
  const result = emitProgressSafely(
    value => {
      assert.equal(value, payload);
      throw new Error("progress UI failed");
    },
    payload,
    (error, value) => errors.push({ message: error.message, payload: value })
  );

  assert.equal(result, false);
  assert.deepEqual(errors, [{ message: "progress UI failed", payload }]);
});

test("reports rejected asynchronous observers without creating an unhandled rejection", async () => {
  const payload = { phase: "completed", sceneIndex: 1 };
  const errors = [];
  const result = emitProgressSafely(
    () => Promise.reject(new Error("async progress UI failed")),
    payload,
    (error, value) => errors.push({ message: error.message, payload: value })
  );

  assert.equal(result, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(errors, [{ message: "async progress UI failed", payload }]);
});

test("does not let the error reporter create a second failure", () => {
  assert.doesNotThrow(() => emitProgressSafely(
    () => { throw new Error("observer failed"); },
    {},
    () => { throw new Error("error reporter failed"); }
  ));
});

test("returns false when no callable observer is supplied", () => {
  assert.equal(emitProgressSafely(null, {}), false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createSceneVideoStorage, persistSceneVideoBestEffort } from "../src/scene-video-storage.js";

function createMemoryIndexedDB() {
  const records = new Map();
  const names = new Set();
  const database = {
    objectStoreNames: { contains: name => names.has(name) },
    createObjectStore(name) { names.add(name); return {}; },
    transaction() {
      const transaction = {
        pendingRequests: 0,
        objectStore() {
          return {
            put(record) { return request(() => { records.set(record.sceneId, record); return record; }, transaction); },
            get(key) { return request(() => records.get(key), transaction); },
            delete(key) { return request(() => { records.delete(key); return undefined; }, transaction); }
          };
        }
      };
      return transaction;
    }
  };
  function request(operation, transaction) {
    const result = {};
    transaction.pendingRequests += 1;
    queueMicrotask(() => {
      try {
        result.result = operation();
        result.onsuccess?.();
      } catch (error) {
        result.error = error;
        result.onerror?.();
        transaction.onerror?.();
      } finally {
        transaction.pendingRequests -= 1;
        if (transaction.pendingRequests === 0) queueMicrotask(() => transaction.oncomplete?.());
      }
    });
    return result;
  }
  return {
    database,
    openCount: 0,
    open() {
      this.openCount += 1;
      const result = {};
      queueMicrotask(() => {
        result.result = database;
        result.onupgradeneeded?.();
        result.onsuccess?.();
      });
      return result;
    }
  };
}

test("persists, restores, and deletes a generated scene video", async () => {
  const storage = createSceneVideoStorage({ indexedDBRef: createMemoryIndexedDB() });
  const blob = new Blob(["video-data"], { type: "video/webm" });
  await storage.put("scene-1", blob, "scene-1.webm");
  const restored = await storage.get("scene-1");
  assert.equal(restored.sceneId, "scene-1");
  assert.equal(restored.filename, "scene-1.webm");
  assert.equal(await restored.blob.text(), "video-data");
  await storage.delete("scene-1");
  assert.equal(await storage.get("scene-1"), undefined);
});

test("rejects writes without a stable scene ID or Blob", async () => {
  const storage = createSceneVideoStorage({ indexedDBRef: createMemoryIndexedDB() });
  await assert.rejects(storage.put("", new Blob(["x"])), /stable scene ID/);
  await assert.rejects(storage.put("scene-1", "not-a-blob"), /must be a Blob/);
  await assert.rejects(storage.put("scene-1", new Blob([],{type:"video/webm"})), /must not be empty/);
  await assert.rejects(storage.put("scene-1", new Blob(["not video"],{type:"text/plain"})), /video MIME type/);
  await assert.rejects(storage.put("scene-1", new Blob(["unknown mime"])), /video MIME type/);
});

test("reports when IndexedDB is unavailable", async () => {
  const storage = createSceneVideoStorage({ indexedDBRef: null });
  await assert.rejects(storage.get("scene-1"), /not available/);
});

test("closes stale connections and reopens after an IndexedDB version change", async () => {
  const indexedDBRef = createMemoryIndexedDB();
  const storage = createSceneVideoStorage({ indexedDBRef });
  await storage.get("scene-1");
  assert.equal(indexedDBRef.openCount, 1);
  let closed = 0;
  indexedDBRef.database.close = () => { closed += 1; };
  indexedDBRef.database.onversionchange();
  assert.equal(closed, 1);
  await storage.get("scene-1");
  assert.equal(indexedDBRef.openCount, 2);
});


test("keeps a generated clip usable when optional persistence fails", async () => {
  const blob = new Blob(["video-data"], { type: "video/webm" });
  const storage = { put: async () => { throw new Error("QuotaExceededError"); } };
  const result = await persistSceneVideoBestEffort(storage, "scene-1", blob, "scene-1.webm");
  assert.deepEqual(result, { persisted: false, error: "QuotaExceededError" });
  assert.equal(await blob.text(), "video-data");
});

test("reports successful best-effort scene video persistence", async () => {
  const calls = [];
  const storage = { put: async (...args) => { calls.push(args); } };
  const blob = new Blob(["video-data"], { type: "video/webm" });
  const result = await persistSceneVideoBestEffort(storage, "scene-2", blob, "scene-2.webm");
  assert.deepEqual(result, { persisted: true, error: "" });
  assert.deepEqual(calls, [["scene-2", blob, "scene-2.webm"]]);
});

test("reports unavailable scene video storage without throwing", async () => {
  const result = await persistSceneVideoBestEffort(null, "scene-3", new Blob(["video"]), "scene-3.webm");
  assert.equal(result.persisted, false);
  assert.match(result.error, /unavailable/);
});


test("a late older generation cannot overwrite a newer persisted clip", async () => {
  const storage = createSceneVideoStorage({ indexedDBRef: createMemoryIndexedDB() });
  const newer = new Blob(["new"], { type: "video/webm" });
  const older = new Blob(["old"], { type: "video/webm" });
  await storage.put("scene-race", newer, "new.webm", { generationRevision: 2 });
  const staleWrite = await storage.put("scene-race", older, "old.webm", { generationRevision: 1 });
  assert.equal(staleWrite.superseded, true);
  const restored = await storage.get("scene-race");
  assert.equal(await restored.blob.text(), "new");
  assert.equal(restored.generationRevision, 2);
});

test("stale cleanup only deletes the revision it owns", async () => {
  const storage = createSceneVideoStorage({ indexedDBRef: createMemoryIndexedDB() });
  await storage.put("scene-cleanup", new Blob(["new"], { type: "video/webm" }), "new.webm", { generationRevision: 3 });
  assert.equal(await storage.deleteIfRevision("scene-cleanup", 2), false);
  assert.equal(await (await storage.get("scene-cleanup")).blob.text(), "new");
  assert.equal(await storage.deleteIfRevision("scene-cleanup", 3), true);
  assert.equal(await storage.get("scene-cleanup"), undefined);
});

test("scene edits remove only older persisted revisions", async () => {
  const storage = createSceneVideoStorage({ indexedDBRef: createMemoryIndexedDB() });
  await storage.put("scene-edit", new Blob(["old"], { type: "video/webm" }), "old.webm", { generationRevision: 0 });
  assert.equal(await storage.deleteOlderThanRevision("scene-edit", 1), true);
  await storage.put("scene-edit", new Blob(["fresh"], { type: "video/webm" }), "fresh.webm", { generationRevision: 1 });
  assert.equal(await storage.deleteOlderThanRevision("scene-edit", 1), false);
  assert.equal(await (await storage.get("scene-edit")).blob.text(), "fresh");
});

test("rejects invalid generation revisions", async () => {
  const storage = createSceneVideoStorage({ indexedDBRef: createMemoryIndexedDB() });
  await assert.rejects(storage.put("scene-invalid", new Blob(["x"], { type: "video/webm" }), "x.webm", { generationRevision: -1 }), /non-negative integer/);
  await assert.rejects(storage.deleteIfRevision("scene-invalid", 1.5), /non-negative integer/);
  await assert.rejects(storage.deleteOlderThanRevision("scene-invalid", -1), /non-negative integer/);
});


test("forwards generation revisions and reports superseded persistence", async () => {
  const calls = [];
  const blob = new Blob(["video-data"], { type: "video/webm" });
  const options = { generationRevision: 4 };
  const storage = { put: async (...args) => { calls.push(args); return { superseded: false }; } };
  const saved = await persistSceneVideoBestEffort(storage, "scene-4", blob, "scene-4.webm", options);
  assert.deepEqual(saved, { persisted: true, error: "" });
  assert.deepEqual(calls, [["scene-4", blob, "scene-4.webm", options]]);

  const stale = await persistSceneVideoBestEffort(
    { put: async () => ({ superseded: true }) }, "scene-4", blob, "old.webm", options
  );
  assert.deepEqual(stale, { persisted: false, error: "A newer scene generation already replaced this clip." });
});


test("stale restore cleanup cannot delete a newer generation", async () => {
  const storage = createSceneVideoStorage({ indexedDBRef: createMemoryIndexedDB() });
  const oldBlob = new Blob(["old"], { type: "video/webm" });
  const newBlob = new Blob(["new"], { type: "video/webm" });
  await storage.put("scene-restore-race", oldBlob, "old.webm", { generationRevision: 10 });
  await storage.put("scene-restore-race", newBlob, "new.webm", { generationRevision: 11 });
  assert.equal(await storage.deleteIfRevision("scene-restore-race", 10), false);
  const restored = await storage.get("scene-restore-race");
  assert.equal(await restored.blob.text(), "new");
  assert.equal(restored.generationRevision, 11);
});

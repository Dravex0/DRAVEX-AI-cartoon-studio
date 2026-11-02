import test from "node:test";
import assert from "node:assert/strict";
import { createSceneVideoStorage } from "../src/scene-video-storage.js";
import { createVideoProviderRegistry, generateVideoWithProvider } from "../src/video-provider-contract.js";
import { getDrawableSceneVideo } from "../src/scene-video-render-source.js";

function createMemoryIndexedDB() {
  const records = new Map();
  const names = new Set();
  const database = {
    objectStoreNames: { contains: name => names.has(name) },
    createObjectStore(name) { names.add(name); return {}; },
    transaction() {
      const transaction = {
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
    queueMicrotask(() => {
      try {
        result.result = operation();
        result.onsuccess?.();
        transaction.oncomplete?.();
      } catch (error) {
        result.error = error;
        result.onerror?.();
        transaction.onerror?.();
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
  await assert.rejects(storage.put("scene-1", new Blob([])), /must not be empty/);
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

test("routes a fake provider clip through persistent storage to the drawable export source", async () => {
  const storage = createSceneVideoStorage({ indexedDBRef: createMemoryIndexedDB() });
  const expectedBytes = "generated-scene-motion";
  const providerBlob = new Blob([expectedBytes], { type: "video/webm" });
  const registry = createVideoProviderRegistry();
  registry.register({
    id: "deterministic-test-provider",
    name: "Deterministic test provider",
    taskTypes: ["image-to-video"],
    generate: async () => ({ status: "completed", video: providerBlob })
  });

  const generated = await generateVideoWithProvider(registry, "deterministic-test-provider", {
    taskType: "image-to-video",
    prompt: "A fox turns toward a glowing star.",
    durationSeconds: 2,
    fps: 16,
    image: new Blob(["source-image"], { type: "image/png" })
  });
  assert.equal(generated.status, "completed");
  assert.equal(generated.video, providerBlob);

  await storage.put("stable-scene-fox-01", generated.video, "fox-motion.webm");
  const restored = await storage.get("stable-scene-fox-01");
  assert.equal(await restored.blob.text(), expectedBytes);
  assert.equal(restored.filename, "fox-motion.webm");

  const decodedVideo = {
    readyState: 2,
    videoWidth: 640,
    videoHeight: 360,
    sourceBlob: restored.blob
  };
  const renderCache = new Map([
    ["stable-scene-fox-01", { video: decodedVideo, blob: restored.blob }]
  ]);

  assert.equal(getDrawableSceneVideo(renderCache, "stable-scene-fox-01"), decodedVideo);
  assert.equal(getDrawableSceneVideo(renderCache, "missing-scene"), null);
  assert.equal(getDrawableSceneVideo(new Map([
    ["not-decoded", { video: { readyState: 1, videoWidth: 0, videoHeight: 0 } }]
  ]), "not-decoded"), null);
});

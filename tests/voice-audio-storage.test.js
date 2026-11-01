import test from "node:test";
import assert from "node:assert/strict";
import { createVoiceAudioStorage } from "../src/voice-audio-storage.js";

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
            put(record) { return request(() => { records.set(record.audioHash, record); return record; }, transaction); },
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

const HASH = "a".repeat(64);

test("persists, restores, and deletes voice audio by full SHA-256 hash", async () => {
  const storage = createVoiceAudioStorage({ indexedDBRef: createMemoryIndexedDB() });
  const blob = new Blob(["RIFF-audio"], { type: "audio/wav" });
  const saved = await storage.put(HASH, blob, {
    filename: "mira.wav", engineUsed: "piper", sampleRate: 22050, durationMs: 1250
  });
  assert.equal(saved.audioHash, HASH);
  assert.equal(saved.byteSize, blob.size);
  const restored = await storage.get(HASH);
  assert.equal(await restored.blob.text(), "RIFF-audio");
  assert.equal(restored.filename, "mira.wav");
  assert.equal(restored.engineUsed, "piper");
  assert.equal(restored.sampleRate, 22050);
  assert.equal(restored.durationMs, 1250);
  await storage.delete(HASH);
  assert.equal(await storage.get(HASH), undefined);
});

test("rejects malformed hashes, empty blobs, and invalid metadata", async () => {
  const storage = createVoiceAudioStorage({ indexedDBRef: createMemoryIndexedDB() });
  await assert.rejects(storage.put("short", new Blob(["x"])), /SHA-256/);
  await assert.rejects(storage.put(HASH, new Blob([])), /must not be empty/);
  await assert.rejects(storage.put(HASH, new Blob(["x"]), { durationMs: 0 }), /durationMs/);
  await assert.rejects(storage.put(HASH, new Blob(["x"]), { sampleRate: 22050.5 }), /sampleRate/);
});

test("reports when IndexedDB is unavailable", async () => {
  const storage = createVoiceAudioStorage({ indexedDBRef: null });
  await assert.rejects(storage.get(HASH), /not available/);
});

test("closes stale connections and reopens after an IndexedDB version change", async () => {
  const indexedDBRef = createMemoryIndexedDB();
  const storage = createVoiceAudioStorage({ indexedDBRef });
  await storage.get(HASH);
  assert.equal(indexedDBRef.openCount, 1);
  let closed = 0;
  indexedDBRef.database.close = () => { closed += 1; };
  indexedDBRef.database.onversionchange();
  assert.equal(closed, 1);
  await storage.get(HASH);
  assert.equal(indexedDBRef.openCount, 2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterReferenceImageStorage, CHARACTER_REFERENCE_IMAGE_LIMITS } from '../src/character-reference-image-storage.js';

test('exposes a bounded local image format policy', () => {
  assert.equal(CHARACTER_REFERENCE_IMAGE_LIMITS.maxBytes, 12 * 1024 * 1024);
  assert.deepEqual(new Set(CHARACTER_REFERENCE_IMAGE_LIMITS.mimeTypes), new Set(['image/png', 'image/jpeg', 'image/webp']));
});

test('rejects invalid asset IDs, empty data, and unsupported image types before opening IndexedDB', async () => {
  const storage = createCharacterReferenceImageStorage({ indexedDBRef: null });
  await assert.rejects(storage.put('bad', new Blob(['x'], { type: 'image/png' })), /stable character reference asset ID/);
  await assert.rejects(storage.put('refimg_12345678', new Blob([], { type: 'image/png' })), /must not be empty/);
  await assert.rejects(storage.put('refimg_12345678', new Blob(['x'], { type: 'image/gif' })), /PNG, JPEG, or WebP/);
});

test('rejects oversized reference images before opening IndexedDB', async () => {
  const storage = createCharacterReferenceImageStorage({ indexedDBRef: null });
  const oversized = new Blob([new Uint8Array(CHARACTER_REFERENCE_IMAGE_LIMITS.maxBytes + 1)], { type: 'image/png' });
  await assert.rejects(storage.put('refimg_12345678', oversized), /12 MB or smaller/);
});

test('does not attempt persistence when IndexedDB is unavailable', async () => {
  const storage = createCharacterReferenceImageStorage({ indexedDBRef: null });
  await assert.rejects(storage.put('refimg_12345678', new Blob(['x'], { type: 'image/png' })), /IndexedDB is not available/);
  assert.equal(await storage.get('refimg_12345678').catch(error => error.message), 'IndexedDB is not available in this browser.');
});

function memoryDB() {
  const records = new Map();
  const names = new Set();
  const database = {
    objectStoreNames: { contains: name => names.has(name) },
    createObjectStore(name) { names.add(name); },
    transaction() {
      const tx = {
        objectStore() {
          return {
            put(value) { return request(() => { records.set(value.assetId, value); return value; }, tx); },
            get(key) { return request(() => records.get(key), tx); },
            delete(key) { return request(() => records.delete(key), tx); }
          };
        }
      };
      return tx;
    }
  };
  function request(operation, tx) {
    const result = {};
    queueMicrotask(() => {
      try { result.result = operation(); result.onsuccess?.(); tx.oncomplete?.(); }
      catch (error) { result.error = error; result.onerror?.(); tx.onerror?.(); }
    });
    return result;
  }
  return {
    open() {
      const result = {};
      queueMicrotask(() => { result.result = database; result.onupgradeneeded?.(); result.onsuccess?.(); });
      return result;
    }
  };
}

test('stores, reads and deletes a character reference Blob in IndexedDB', async () => {
  const storage = createCharacterReferenceImageStorage({ indexedDBRef: memoryDB() });
  const blob = new Blob(['character-image'], { type: 'image/png' });
  const saved = await storage.put('refimg_12345678', blob, 'hero.png');
  assert.equal(saved.filename, 'hero.png');
  assert.equal((await storage.get('refimg_12345678')).blob.size, blob.size);
  await storage.delete('refimg_12345678');
  assert.equal(await storage.get('refimg_12345678'), undefined);
});

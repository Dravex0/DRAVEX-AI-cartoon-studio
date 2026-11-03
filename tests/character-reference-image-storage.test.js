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

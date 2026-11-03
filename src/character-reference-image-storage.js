const DATABASE_NAME = "dravex-character-reference-images";
const DATABASE_VERSION = 1;
const STORE_NAME = "reference-images";
const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Character reference storage request failed."));
  });
}
function transactionCompletion(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("Character reference storage transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("Character reference storage transaction aborted."));
  });
}

/** Stores character reference image Blobs locally in IndexedDB; never uploads them. */
export function createCharacterReferenceImageStorage({ indexedDBRef = globalThis.indexedDB } = {}) {
  let databasePromise;
  function openDatabase() {
    if (!indexedDBRef || typeof indexedDBRef.open !== "function") {
      return Promise.reject(new Error("IndexedDB is not available in this browser."));
    }
    if (!databasePromise) {
      databasePromise = new Promise((resolve, reject) => {
        const request = indexedDBRef.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME, { keyPath: "assetId" });
          }
        };
        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => { database.close?.(); databasePromise = null; };
          database.onclose = () => { databasePromise = null; };
          resolve(database);
        };
        request.onerror = () => { databasePromise = null; reject(request.error || new Error("Could not open character reference storage.")); };
        request.onblocked = () => { databasePromise = null; reject(new Error("Character reference storage is blocked by another tab.")); };
      });
    }
    return databasePromise;
  }
  async function run(operation, mode = "readonly") {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, mode);
    const completed = transactionCompletion(transaction);
    let result;
    try { result = operation(transaction.objectStore(STORE_NAME)); }
    catch (error) { transaction.abort(); throw error; }
    try {
      const value = result && typeof result.then === "function" ? await result : result;
      await completed;
      return value;
    } catch (error) {
      try { await completed; } catch {}
      throw error;
    }
  }
  return {
    async put(assetId, blob, filename = "character-reference.png") {
      const id = String(assetId || "").trim();
      if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id)) throw new TypeError("A stable character reference asset ID is required.");
      if (!(typeof Blob !== "undefined" && blob instanceof Blob)) throw new TypeError("Character reference must be an image Blob.");
      if (!blob.size) throw new TypeError("Character reference image must not be empty.");
      if (blob.size > MAX_BYTES) throw new RangeError("Character reference image must be 12 MB or smaller.");
      if (!ALLOWED_TYPES.has(String(blob.type || "").toLowerCase())) throw new TypeError("Use a PNG, JPEG, or WebP character reference.");
      const record = { assetId: id, blob, filename: String(filename || "character-reference.png").slice(0, 180), mimeType: blob.type, byteSize: blob.size, updatedAt: Date.now() };
      await run(store => requestResult(store.put(record)), "readwrite");
      return record;
    },
    async get(assetId) {
      const id = String(assetId || "").trim();
      if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id)) return null;
      return run(store => requestResult(store.get(id)));
    },
    async delete(assetId) {
      const id = String(assetId || "").trim();
      if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id)) return;
      await run(store => requestResult(store.delete(id)), "readwrite");
    }
  };
}
export const CHARACTER_REFERENCE_IMAGE_LIMITS = Object.freeze({ maxBytes: MAX_BYTES, mimeTypes: [...ALLOWED_TYPES] });

const DATABASE_NAME = "dravex-cartoon-audio-assets";
const DATABASE_VERSION = 1;
const STORE_NAME = "voice-audio";

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Voice audio storage request failed."));
  });
}

function transactionCompletion(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Voice audio storage transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("Voice audio storage transaction was aborted."));
  });
}

function normalizeMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new TypeError("Voice audio metadata must be an object.");
  }
  const durationMs = metadata.durationMs == null ? null : Number(metadata.durationMs);
  const sampleRate = metadata.sampleRate == null ? null : Number(metadata.sampleRate);
  if (durationMs !== null && (!Number.isFinite(durationMs) || durationMs <= 0)) {
    throw new RangeError("Voice audio durationMs must be a finite positive number.");
  }
  if (sampleRate !== null && (!Number.isInteger(sampleRate) || sampleRate <= 0)) {
    throw new RangeError("Voice audio sampleRate must be a positive integer.");
  }
  return {
    filename: String(metadata.filename || "voice-audio.wav").slice(0, 180),
    mimeType: String(metadata.mimeType || "").slice(0, 100),
    engineUsed: String(metadata.engineUsed || "").slice(0, 80),
    durationMs,
    sampleRate
  };
}

/**
 * Browser-local persistence for generated voice Blobs.
 * The full SHA-256 audio hash is the key; no network or cloud access is used.
 */
export function createVoiceAudioStorage({ indexedDBRef = globalThis.indexedDB } = {}) {
  let databasePromise;

  function openDatabase() {
    if (!indexedDBRef || typeof indexedDBRef.open !== "function") {
      return Promise.reject(new Error("IndexedDB is not available in this browser."));
    }
    if (!databasePromise) {
      databasePromise = new Promise((resolve, reject) => {
        const request = indexedDBRef.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME, { keyPath: "audioHash" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          databasePromise = null;
          reject(request.error || new Error("Could not open voice audio storage."));
        };
        request.onblocked = () => {
          databasePromise = null;
          reject(new Error("Voice audio storage is blocked by another tab."));
        };
      });
    }
    return databasePromise;
  }

  async function run(operation, mode = "readonly") {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, mode);
    const completed = transactionCompletion(transaction);
    let result;
    try {
      result = operation(transaction.objectStore(STORE_NAME));
    } catch (error) {
      transaction.abort();
      throw error;
    }
    try {
      const value = result && typeof result.then === "function" ? await result : result;
      await completed;
      return value;
    } catch (error) {
      try { await completed; } catch {}
      throw error;
    }
  }

  function normalizeHash(value) {
    const hash = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      throw new TypeError("A full 64-character SHA-256 audio hash is required.");
    }
    return hash;
  }

  return {
    async put(audioHash, blob, metadata = {}) {
      const key = normalizeHash(audioHash);
      if (!(typeof Blob !== "undefined" && blob instanceof Blob)) {
        throw new TypeError("Voice audio data must be a Blob.");
      }
      if (blob.size === 0) throw new TypeError("Voice audio Blob must not be empty.");
      const record = {
        audioHash: key,
        blob,
        ...normalizeMetadata(metadata),
        byteSize: blob.size,
        updatedAt: Date.now()
      };
      await run(store => requestResult(store.put(record)), "readwrite");
      return record;
    },

    async get(audioHash) {
      if (typeof audioHash !== "string" || !audioHash.trim()) return null;
      return run(store => requestResult(store.get(normalizeHash(audioHash))));
    },

    async delete(audioHash) {
      if (typeof audioHash !== "string" || !audioHash.trim()) return;
      await run(store => requestResult(store.delete(normalizeHash(audioHash))), "readwrite");
    }
  };
}

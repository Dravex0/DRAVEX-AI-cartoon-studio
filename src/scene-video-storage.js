const DATABASE_NAME = "dravex-cartoon-assets";
const DATABASE_VERSION = 1;
const STORE_NAME = "scene-videos";

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

function transactionCompletion(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction was aborted."));
  });
}

export function createSceneVideoStorage({ indexedDBRef = globalThis.indexedDB } = {}) {
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
            database.createObjectStore(STORE_NAME, { keyPath: "sceneId" });
          }
        };
        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => {
            database.close?.();
            databasePromise = null;
          };
          database.onclose = () => {
            databasePromise = null;
          };
          resolve(database);
        };
        request.onerror = () => {
          databasePromise = null;
          reject(request.error || new Error("Could not open scene video storage."));
        };
        request.onblocked = () => {
          databasePromise = null;
          reject(new Error("Scene video storage is blocked by another tab."));
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

  return {
    async put(sceneId, blob, filename = "scene-video.webm") {
      const key = String(sceneId || "").trim();
      if (!key) throw new TypeError("A stable scene ID is required.");
      if (!(typeof Blob !== "undefined" && blob instanceof Blob)) {
        throw new TypeError("Scene video data must be a Blob.");
      }
      if (blob.size === 0) throw new TypeError("Scene video Blob must not be empty.");
      const safeFilename = String(filename || "scene-video.webm").slice(0, 180);
      const record = { sceneId: key, blob, filename: safeFilename, updatedAt: Date.now() };
      await run(store => requestResult(store.put(record)), "readwrite");
      return record;
    },

    async get(sceneId) {
      const key = String(sceneId || "").trim();
      if (!key) return null;
      return run(store => requestResult(store.get(key)));
    },

    async delete(sceneId) {
      const key = String(sceneId || "").trim();
      if (!key) return;
      await run(store => requestResult(store.delete(key)), "readwrite");
    }
  };
}

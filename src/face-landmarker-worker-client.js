export const FACE_LANDMARKER_RUNTIME_VERSION = "1.2.0";

function createDefaultWorker() {
  if (typeof Worker !== "function") throw new Error("Web Workers are not supported in this browser.");
  return new Worker(new URL("./face-landmarker.worker.js", import.meta.url), { type: "module" });
}

/**
 * A single-flight client for local face landmark analysis.
 * The caller transfers ownership of each ImageBitmap to the worker.
 */
export function createFaceLandmarkerWorkerClient({
  workerFactory = createDefaultWorker,
  requestTimeoutMs = 30000
} = {}) {
  if (typeof workerFactory !== "function") throw new TypeError("workerFactory must be a function.");
  if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs < 1000 || requestTimeoutMs > 120000) {
    throw new RangeError("requestTimeoutMs must be between 1000 and 120000.");
  }
  const worker = workerFactory();
  if (!worker || typeof worker.postMessage !== "function" || typeof worker.terminate !== "function") {
    throw new TypeError("workerFactory must return a Worker-like object.");
  }
  let nextId = 1;
  let pending = null;
  let disposed = false;
  let lastTimestampMs = -1;

  const clearPending = () => {
    if (!pending) return null;
    clearTimeout(pending.timer);
    const current = pending;
    pending = null;
    return current;
  };
  const failPending = error => {
    const current = clearPending();
    current?.reject(error);
  };
  worker.onmessage = event => {
    const message = event?.data;
    if (!pending || message?.id !== pending.id) return;
    const current = clearPending();
    if (message.ok) current.resolve(message.result);
    else {
      const error = new Error(String(message.error?.message || "Face landmark worker request failed."));
      error.name = String(message.error?.name || "Error");
      current.reject(error);
    }
  };
  worker.onerror = event => {
    failPending(new Error(String(event?.message || "Face landmark worker crashed.")));
  };
  worker.onmessageerror = () => failPending(new Error("Could not read the face landmark worker response."));

  function request(type, payload = {}, transfer = []) {
    if (disposed) return Promise.reject(new Error("Face landmark worker client is disposed."));
    if (pending) return Promise.reject(new Error("A face landmark request is already running."));
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const current = clearPending();
        current?.reject(new Error("Face landmark worker request timed out."));
        worker.terminate();
        disposed = true;
      }, requestTimeoutMs);
      pending = { id, resolve, reject, timer };
      try {
        worker.postMessage({ id, type, ...payload }, transfer);
      } catch (error) {
        clearPending();
        reject(error);
      }
    });
  }

  return {
    initialize({ delegate = "CPU" } = {}) {
      if (delegate !== "CPU" && delegate !== "GPU") return Promise.reject(new TypeError("delegate must be CPU or GPU."));
      return request("initialize", { delegate });
    },
    processFrame(frame, timestampMs) {
      if (!frame || typeof frame.close !== "function" || !Number.isFinite(timestampMs) || timestampMs < 0) {
        return Promise.reject(new TypeError("A transferable ImageBitmap and non-negative timestamp are required."));
      }
      if (timestampMs <= lastTimestampMs) return Promise.reject(new RangeError("Frame timestamps must increase monotonically."));
      if (pending) return Promise.reject(new Error("A face landmark request is already running."));
      lastTimestampMs = timestampMs;
      return request("process-frame", { frame, timestampMs }, [frame]).catch(error => {
        lastTimestampMs = -1;
        throw error;
      });
    },
    async dispose() {
      if (disposed) return;
      try {
        if (pending) failPending(new Error("Face landmark worker client was disposed."));
        await request("dispose");
      } finally {
        disposed = true;
        worker.terminate();
      }
    },
    get isDisposed() { return disposed; }
  };
}

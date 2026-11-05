import { deriveFaceLandmarkAnchors } from "./face-landmark-anchors.js";

const TASKS_VISION_VERSION = "1.2.0";
const VISION_BUNDLE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/vision_bundle.mjs`;
const WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarker = null;
let lastTimestampMs = -1;

function send(id, payload) {
  self.postMessage({ id, ...payload });
}

function serializeError(error) {
  return {
    name: String(error?.name || "Error").slice(0, 80),
    message: String(error?.message || "Face landmark worker failed.").slice(0, 500)
  };
}

async function initialize(delegate = "CPU") {
  if (landmarker) return { status: "ready", version: TASKS_VISION_VERSION };
  if (delegate !== "CPU" && delegate !== "GPU") throw new TypeError("Unsupported MediaPipe delegate.");
  const { FilesetResolver, FaceLandmarker } = await import(VISION_BUNDLE_URL);
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
  landmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false
  });
  lastTimestampMs = -1;
  return { status: "ready", version: TASKS_VISION_VERSION, delegate };
}

async function handleMessage(message) {
  const { id, type } = message || {};
  if (!Number.isInteger(id)) return;
  try {
    if (type === "initialize") {
      send(id, { ok: true, result: await initialize(message.delegate || "CPU") });
      return;
    }
    if (type === "process-frame") {
      if (!landmarker) throw new Error("Face landmark worker is not initialized.");
      const frame = message.frame;
      const timestampMs = Number(message.timestampMs);
      if (!frame || typeof frame.close !== "function" || !Number.isFinite(timestampMs) || timestampMs < 0) {
        throw new TypeError("A transferable ImageBitmap and non-negative timestamp are required.");
      }
      if (timestampMs <= lastTimestampMs) throw new RangeError("Video frame timestamps must increase monotonically.");
      try {
        const detection = landmarker.detectForVideo(frame, timestampMs);
        lastTimestampMs = timestampMs;
        const faces = Array.isArray(detection?.faceLandmarks) ? detection.faceLandmarks : [];
        if (!faces.length) {
          send(id, { ok: true, result: { status: "no-face", faceCount: 0, anchors: null, timestampMs } });
          return;
        }
        const geometry = deriveFaceLandmarkAnchors(faces[0]);
        send(id, { ok: true, result: {
          status: geometry.status === "ready" ? "face-detected" : "invalid-landmarks",
          faceCount: faces.length,
          anchors: geometry.anchors,
          issues: geometry.issues,
          timestampMs
        } });
      } finally {
        frame.close();
      }
      return;
    }
    if (type === "dispose") {
      landmarker?.close?.();
      landmarker = null;
      lastTimestampMs = -1;
      send(id, { ok: true, result: { status: "disposed" } });
      return;
    }
    throw new TypeError("Unknown face landmark worker message.");
  } catch (error) {
    send(id, { ok: false, error: serializeError(error) });
  }
}

self.addEventListener("message", event => { void handleMessage(event.data); });

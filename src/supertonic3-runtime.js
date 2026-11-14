import { synthesizeSupertonic3Speech } from "./supertonic3-inference.js";
import {
  SUPERTONIC3_MODEL,
  getSupertonic3Model,
  getSupertonic3AssetUrls,
  getSupertonic3VoiceStyleUrl
} from "./supertonic3-model.js";

const ONNX_ASSETS = new Set([
  "onnx/duration_predictor.onnx",
  "onnx/text_encoder.onnx",
  "onnx/vector_estimator.onnx",
  "onnx/vocoder.onnx"
]);
const JSON_ASSETS = new Set(["onnx/tts.json", "onnx/unicode_indexer.json"]);
const SESSION_ORDER = [
  ["durationPredictor", "onnx/duration_predictor.onnx"],
  ["textEncoder", "onnx/text_encoder.onnx"],
  ["vectorEstimator", "onnx/vector_estimator.onnx"],
  ["vocoder", "onnx/vocoder.onnx"]
];

function assertNotAborted(signal) {
  if (signal?.aborted) {
    const error = new Error("Supertonic 3 loading was cancelled.");
    error.name = "AbortError";
    throw error;
  }
}

function report(callback, detail) {
  if (typeof callback !== "function") return;
  try { callback(Object.freeze({ ...detail })); } catch { /* UI callbacks are isolated. */ }
}

function flattenFinite(values, label) {
  if (!Array.isArray(values)) throw new TypeError(label + " must be an array.");
  const flat = values.flat(Infinity);
  if (!flat.length || flat.some(value => !Number.isFinite(Number(value)))) {
    throw new TypeError(label + " contains no usable numeric values.");
  }
  return Float32Array.from(flat, Number);
}

function validateStylePart(part, label) {
  const dims = part?.dims;
  if (!Array.isArray(dims) || dims.length !== 3 || dims.some(value => !Number.isInteger(value) || value <= 0)) {
    throw new TypeError(label + " has invalid tensor dimensions.");
  }
  const data = flattenFinite(part.data, label + ".data");
  if (data.length !== dims.reduce((product, value) => product * value, 1)) {
    throw new RangeError(label + " data length does not match its tensor dimensions.");
  }
  return { dims: [...dims], data };
}

/**
 * Loads pinned Supertonic 3 ONNX sessions locally in the browser.
 * This is a model/session loader only: speech inference is deliberately not
 * advertised as ready until the separate inference adapter is connected.
 */
export function createSupertonic3Runtime({
  runtimeFactory = () => import("onnxruntime-web"),
  fetchImpl = globalThis.fetch?.bind(globalThis)
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required.");
  let loaded = null;
  let loading = null;

  async function fetchResponse(url, signal, onProgress, assetName) {
    assertNotAborted(signal);
    const response = await fetchImpl(url, { signal, cache: "force-cache" });
    if (!response?.ok) throw new Error("Could not download " + assetName + " (HTTP " + (response?.status ?? "unknown") + ").");
    const buffer = await response.arrayBuffer();
    assertNotAborted(signal);
    if (!buffer.byteLength) throw new Error(assetName + " downloaded as an empty file.");
    report(onProgress, { phase: "downloaded", asset: assetName, bytes: buffer.byteLength });
    return buffer;
  }

  return Object.freeze({
    get status() {
      return loaded ? {
        loaded: true,
        locale: loaded.locale,
        backend: loaded.backend,
        modelId: SUPERTONIC3_MODEL.modelId,
        modelRevision: SUPERTONIC3_MODEL.revision,
        sessionNames: Object.keys(loaded.sessions),
        inferenceAdapterAvailable: true,
        inferenceReady: false
      } : { loaded: false, inferenceReady: false };
    },

    async load({
      locale,
      acceptOpenRailTerms = false,
      backend = "wasm",
      signal,
      onProgress
    } = {}) {
      assertNotAborted(signal);
      const model = getSupertonic3Model(locale, { acceptOpenRailTerms });
      if (!model.available) {
        throw new Error(model.reason === "license-review-required"
          ? "Review and explicitly accept the OpenRAIL-M model terms before loading Supertonic 3."
          : "Supertonic 3 does not support the requested language.");
      }
      if (!["wasm", "webgpu"].includes(backend)) throw new TypeError("backend must be wasm or webgpu.");
      const key = model.locale + "|" + backend;
      if (loaded?.key === key) return this.status;
      if (loading) {
        if (loading.key !== key) throw new Error("Another Supertonic 3 load is already in progress.");
        return loading.promise;
      }

      const promise = (async () => {
        const ort = await runtimeFactory();
        if (!ort?.InferenceSession?.create || !ort?.Tensor) {
          throw new Error("ONNX Runtime Web did not expose the required browser API.");
        }
        const assets = new Map(getSupertonic3AssetUrls().map(asset => [asset.path, asset.url]));
        const json = Object.create(null);
        for (const path of JSON_ASSETS) {
          const buffer = await fetchResponse(assets.get(path), signal, onProgress, path);
          json[path] = JSON.parse(new TextDecoder().decode(buffer));
          report(onProgress, { phase: "prepared", asset: path });
        }

        const sessions = Object.create(null);
        try {
          for (let index = 0; index < SESSION_ORDER.length; index += 1) {
            assertNotAborted(signal);
            const [name, path] = SESSION_ORDER[index];
            if (!ONNX_ASSETS.has(path)) throw new Error("Unregistered ONNX asset: " + path);
            report(onProgress, { phase: "loading-session", asset: path, current: index + 1, total: SESSION_ORDER.length });
            const buffer = await fetchResponse(assets.get(path), signal, onProgress, path);
            assertNotAborted(signal);
            sessions[name] = await ort.InferenceSession.create(new Uint8Array(buffer), {
              executionProviders: [backend],
              graphOptimizationLevel: "all"
            });
            assertNotAborted(signal);
            report(onProgress, { phase: "session-ready", asset: path, current: index + 1, total: SESSION_ORDER.length });
          }
        } catch (error) {
          await Promise.all(Object.values(sessions).map(async session => {
            try { await session?.release?.(); } catch { /* Best-effort partial cleanup. */ }
          }));
          throw error;
        }

        loaded = {
          key,
          locale: model.locale,
          backend,
          ort,
          sessions,
          config: json["onnx/tts.json"],
          unicodeIndexer: json["onnx/unicode_indexer.json"],
          voiceStyles: new Map()
        };
        report(onProgress, { phase: "runtime-ready", inferenceAdapterAvailable: true, inferenceReady: false });
        return this.status;
      })();

      loading = { key, promise };
      try {
        return await promise;
      } finally {
        loading = null;
      }
    },

    async loadVoiceStyle(voiceId, { signal, onProgress } = {}) {
      assertNotAborted(signal);
      if (!loaded) throw new Error("Load the Supertonic 3 ONNX sessions first.");
      const key = String(voiceId).trim().toUpperCase();
      if (loaded.voiceStyles.has(key)) return loaded.voiceStyles.get(key);
      const url = getSupertonic3VoiceStyleUrl(key);
      const buffer = await fetchResponse(url, signal, onProgress, "voice_styles/" + key + ".json");
      const parsed = JSON.parse(new TextDecoder().decode(buffer));
      const ttl = validateStylePart(parsed.style_ttl, "style_ttl");
      const dp = validateStylePart(parsed.style_dp, "style_dp");
      assertNotAborted(signal);
      const style = Object.freeze({
        voiceId: key,
        styleTtl: new loaded.ort.Tensor("float32", ttl.data, ttl.dims),
        styleDp: new loaded.ort.Tensor("float32", dp.data, dp.dims)
      });
      loaded.voiceStyles.set(key, style);
      return style;
    },

    async synthesize(options = {}) {
      if (!loaded) throw new Error("Load the Supertonic 3 ONNX sessions first.");
      return synthesizeSupertonic3Speech({
        state: loaded,
        ...options,
        loadVoiceStyle: (voiceId, styleOptions) => this.loadVoiceStyle(voiceId, styleOptions)
      });
    },

    async close() {
      const previous = loaded;
      loaded = null;
      if (previous) {
        await Promise.all(Object.values(previous.sessions).map(async session => {
          try { await session.release?.(); } catch { /* Best-effort resource cleanup. */ }
        }));
      }
      return this.status;
    }
  });
}

/**
 * Supertonic 3 model metadata for the isolated local TTS prototype.
 *
 * Model weights: OpenRAIL-M (not MIT). Runtime/sample code: MIT.
 * Model assets are downloaded only by a future explicit-consent loader.
 * The upstream implementation and model archive are no longer maintained.
 */
export const SUPERTONIC3_MODEL = Object.freeze({
  id: "supertonic3",
  runtime: "onnxruntime-web",
  modelId: "supertone-oss-archive/supertonic-3",
  revision: "aafc6e32416a594460b32413efc49d7fe4ce6d46",
  license: "OpenRAIL-M",
  licenseUrl: "https://huggingface.co/supertone-oss-archive/supertonic-3/blob/aafc6e32416a594460b32413efc49d7fe4ce6d46/LICENSE",
  sourceUrl: "https://github.com/supertone-oss-archive/supertonic",
  codeLicense: "MIT",
  codeLicenseUrl: "https://github.com/supertone-oss-archive/supertonic/blob/main/LICENSE",
  licenseReviewRequired: true,
  archived: true,
  approximateOnnxBytes: 398_000_000,
  approximateVoiceStyleBytes: 2_920_000,
  sampleRate: 44_100,
  languages: Object.freeze([
    "en", "ko", "ja", "ar", "bg", "cs", "da", "de", "el", "es", "et",
    "fi", "fr", "hi", "hr", "hu", "id", "it", "lt", "lv", "nl", "pl",
    "pt", "ro", "ru", "sk", "sl", "sv", "tr", "uk", "vi"
  ]),
  voicePresets: Object.freeze([
    "M1", "M2", "M3", "M4", "M5", "F1", "F2", "F3", "F4", "F5"
  ])
});

const MODEL_ASSETS = Object.freeze([
  "onnx/duration_predictor.onnx",
  "onnx/text_encoder.onnx",
  "onnx/vector_estimator.onnx",
  "onnx/vocoder.onnx",
  "onnx/tts.json",
  "onnx/unicode_indexer.json"
]);

const normalizeLocale = value =>
  String(value ?? "").trim().toLowerCase().split(/[-_]/)[0];

export function getSupertonic3Model(locale, { acceptOpenRailTerms = false } = {}) {
  const key = normalizeLocale(locale);
  if (!SUPERTONIC3_MODEL.languages.includes(key)) {
    return { available: false, reason: "unsupported-locale", locale: key || null };
  }
  if (acceptOpenRailTerms !== true) {
    return {
      available: false,
      reason: "license-review-required",
      locale: key,
      license: SUPERTONIC3_MODEL.license,
      licenseUrl: SUPERTONIC3_MODEL.licenseUrl
    };
  }
  return {
    available: true,
    ...SUPERTONIC3_MODEL,
    locale: key,
    languages: [...SUPERTONIC3_MODEL.languages],
    voicePresets: [...SUPERTONIC3_MODEL.voicePresets]
  };
}

export function getSupertonic3AssetUrls() {
  const root = `https://huggingface.co/${SUPERTONIC3_MODEL.modelId}/resolve/${SUPERTONIC3_MODEL.revision}/`;
  return MODEL_ASSETS.map(path => ({ path, url: root + path }));
}

export function listSupertonic3Voices() {
  return [...SUPERTONIC3_MODEL.voicePresets];
}

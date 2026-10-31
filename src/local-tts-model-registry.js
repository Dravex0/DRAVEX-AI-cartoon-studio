const MODEL_REGISTRY = Object.freeze({
  en: Object.freeze({
    id: "kokoro-en",
    modelId: "onnx-community/Kokoro-82M-v1.0-ONNX",
    locale: "en",
    languages: Object.freeze(["en"]),
    license: "Apache-2.0",
    commercialUse: true,
    dtype: "q8",
    approximateQuantizedWeightBytes: 92_400_000,
    voiceMode: "model-dependent",
    notes: "English-only model. Do not assume character-specific voice selection until the selected Transformers.js model path is verified."
  }),
  ru: Object.freeze({
    id: "mms-ru",
    modelId: "Xenova/mms-tts-rus",
    locale: "ru",
    languages: Object.freeze(["ru"]),
    license: "CC-BY-NC-4.0",
    commercialUse: false,
    dtype: "q8",
    approximateQuantizedWeightBytes: 38_400_000,
    voiceMode: "single-speaker",
    notes: "Non-commercial model; one speaker. Requires explicit non-commercial-use opt-in."
  }),
  uk: Object.freeze({
    id: "mms-uk",
    modelId: "payam1394/traxlate-mms-tts-ukr",
    locale: "uk",
    languages: Object.freeze(["uk"]),
    license: "CC-BY-NC-4.0",
    commercialUse: false,
    dtype: "q8",
    approximateQuantizedWeightBytes: null,
    voiceMode: "single-speaker",
    notes: "Community ONNX conversion of Meta MMS Ukrainian; non-commercial license; one speaker. Requires explicit non-commercial-use opt-in."
  }),
  es: Object.freeze({
    id: "mms-es",
    modelId: "Xenova/mms-tts-spa",
    locale: "es",
    languages: Object.freeze(["es"]),
    license: "CC-BY-NC-4.0",
    commercialUse: false,
    dtype: "q8",
    approximateQuantizedWeightBytes: null,
    voiceMode: "single-speaker",
    notes: "Non-commercial model; one speaker. Requires explicit non-commercial-use opt-in."
  })
});

const normalizeLocale = value => String(value ?? "").trim().toLowerCase().split(/[-_]/)[0];

/**
 * Resolve a local Transformers.js TTS model without silently accepting
 * non-commercial-only licenses. No model is downloaded by this module.
 */
export function getLocalTtsModel(locale, { allowNonCommercial = false } = {}) {
  const key = normalizeLocale(locale);
  const model = MODEL_REGISTRY[key];
  if (!model) {
    return {
      available: false,
      reason: "unsupported-locale",
      locale: key || null
    };
  }
  if (!model.commercialUse && allowNonCommercial !== true) {
    return {
      available: false,
      reason: "non-commercial-license-requires-opt-in",
      locale: key,
      modelId: model.modelId,
      license: model.license,
      commercialUse: false
    };
  }
  return {
    available: true,
    ...model,
    languages: [...model.languages],
    consentRequired: !model.commercialUse
  };
}

export function listLocalTtsModels() {
  return Object.values(MODEL_REGISTRY).map(model => ({
    id: model.id,
    locale: model.locale,
    languages: [...model.languages],
    modelId: model.modelId,
    license: model.license,
    commercialUse: model.commercialUse,
    approximateQuantizedWeightBytes: model.approximateQuantizedWeightBytes,
    voiceMode: model.voiceMode
  }));
}

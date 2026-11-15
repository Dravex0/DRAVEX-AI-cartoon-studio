const MODEL_REGISTRY = Object.freeze({
  en: Object.freeze({
    id: "kokoro-en",
    runtime: "kokoro-js",
    modelId: "onnx-community/Kokoro-82M-v1.0-ONNX",
    locale: "en",
    languages: Object.freeze(["en"]),
    license: "Apache-2.0",
    commercialUse: true,
    dtype: "q8",
    approximateQuantizedWeightBytes: 92_400_000,
    voiceMode: "multi-voice",
    notes: "English Kokoro model. Runs through kokoro-js; the model and voice assets are downloaded on explicit load."
  }),
  ru: Object.freeze({
    id: "mms-ru",
    runtime: "transformers-js",
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
    id: "piper-uk-ukrainian-tts-medium",
    runtime: "piper-onnx",
    modelId: "piper-uk-ukrainian-tts-medium",
    modelUrl: "https://huggingface.co/rhasspy/piper-voices/resolve/main/uk/uk_UA/ukrainian_tts/medium/uk_UA-ukrainian_tts-medium.onnx",
    configUrl: "https://huggingface.co/rhasspy/piper-voices/resolve/main/uk/uk_UA/ukrainian_tts/medium/uk_UA-ukrainian_tts-medium.onnx.json",
    locale: "uk",
    languages: Object.freeze(["uk"]),
    license: "MIT",
    commercialUse: true,
    dtype: "fp32",
    approximateQuantizedWeightBytes: 76_735_663,
    voiceMode: "multi-speaker",
    voices: Object.freeze(["lada", "mykyta", "tetiana"]),
    notes: "Ukrainian Piper medium ONNX model; three named speakers. The model is downloaded only after explicit load and inference runs locally through ONNX Runtime Web."
  }),
  es: Object.freeze({
    id: "mms-es",
    runtime: "transformers-js",
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
    runtime: model.runtime,
    languages: [...model.languages],
    modelId: model.modelId,
    modelUrl: model.modelUrl ?? null,
    configUrl: model.configUrl ?? null,
    voices: model.voices ? [...model.voices] : [],
    license: model.license,
    commercialUse: model.commercialUse,
    approximateQuantizedWeightBytes: model.approximateQuantizedWeightBytes,
    voiceMode: model.voiceMode
  }));
}

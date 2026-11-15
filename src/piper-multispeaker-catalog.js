const PIPER_MODEL_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main/uk/uk_UA/ukrainian_tts/medium";

export const UKRAINIAN_PIPER_MULTISPEAKER_MODEL = Object.freeze({
  id: "piper-uk-ukrainian-tts-medium",
  locale: "uk",
  runtime: "piper-onnx",
  modelUrl: `${PIPER_MODEL_BASE}/uk_UA-ukrainian_tts-medium.onnx`,
  configUrl: `${PIPER_MODEL_BASE}/uk_UA-ukrainian_tts-medium.onnx.json`,
  modelBytes: 76_735_663,
  sampleRate: 22_050,
  license: "MIT",
  commercialUse: true,
  voiceMode: "multi-speaker",
  voices: Object.freeze([
    Object.freeze({ id: "lada", speakerId: 0, label: "Лада" }),
    Object.freeze({ id: "mykyta", speakerId: 1, label: "Микита" }),
    Object.freeze({ id: "tetiana", speakerId: 2, label: "Тетяна" })
  ])
});

function normalizeVoiceId(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Resolve a named Piper speaker to the exact numeric sid expected by the ONNX
 * model. Never fall back to speaker 0 when a character explicitly requests a
 * missing voice.
 */
export function resolvePiperSpeakerId(modelConfig, voiceId) {
  const requested = normalizeVoiceId(voiceId);
  if (!requested) {
    throw new TypeError("A character voice ID is required for multi-speaker Piper synthesis.");
  }

  const speakerMap = modelConfig?.speaker_id_map;
  if (!speakerMap || typeof speakerMap !== "object" || Array.isArray(speakerMap)) {
    throw new Error("The loaded Piper model does not expose a speaker_id_map.");
  }

  if (!Object.prototype.hasOwnProperty.call(speakerMap, requested)) {
    throw new Error(`Piper voice "${requested}" is not available in the loaded model.`);
  }

  const speakerId = speakerMap[requested];
  if (!Number.isInteger(speakerId) || speakerId < 0) {
    throw new Error(`Piper voice "${requested}" has an invalid speaker ID in the model config.`);
  }

  return speakerId;
}

export function listPiperSpeakers(modelConfig) {
  const speakerMap = modelConfig?.speaker_id_map;
  if (!speakerMap || typeof speakerMap !== "object" || Array.isArray(speakerMap)) return [];
  return Object.entries(speakerMap)
    .filter(([id, speakerId]) => normalizeVoiceId(id) && Number.isInteger(speakerId) && speakerId >= 0)
    .map(([id, speakerId]) => ({ id, speakerId }))
    .sort((a, b) => a.speakerId - b.speakerId);
}

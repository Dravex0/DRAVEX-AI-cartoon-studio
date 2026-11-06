const normalizeLocale = value => String(value ?? "").trim().toLowerCase().split(/[-_]/)[0];

/**
 * Resolve the safe on-device voice-model load plan for a user-started film run.
 * Restricted-language models require explicit non-commercial-use consent;
 * timestamped Kokoro is intentionally English-only.
 */
export function resolvePromptVoiceModelLoad({
  locale,
  engineChoice = "standard",
  nonCommercialConsent = false
} = {}) {
  const language = normalizeLocale(locale);
  const choice = String(engineChoice ?? "").trim().toLowerCase();
  if (!language) return { ok: false, reason: "locale-required" };
  if (!["standard", "timestamped"].includes(choice)) {
    return { ok: false, reason: "unsupported-engine" };
  }
  if (choice === "timestamped" && language !== "en") {
    return { ok: false, reason: "timestamped-english-only", locale: language };
  }
  const restricted = choice === "standard" && language !== "en";
  if (restricted && nonCommercialConsent !== true) {
    return { ok: false, reason: "non-commercial-consent-required", locale: language };
  }
  return {
    ok: true,
    locale: language,
    engineChoice: choice,
    allowNonCommercial: restricted && nonCommercialConsent === true,
    backend: "wasm",
    localInference: true
  };
}

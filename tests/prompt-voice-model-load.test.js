import test from "node:test";
import assert from "node:assert/strict";
import { resolvePromptVoiceModelLoad } from "../src/prompt-voice-model-load.js";

test("allows English standard Kokoro without restricted-license consent", () => {
  assert.deepEqual(resolvePromptVoiceModelLoad({ locale: "en-US" }), {
    ok: true, locale: "en", engineChoice: "standard",
    allowNonCommercial: false, backend: "wasm", localInference: true
  });
});

test("requires explicit non-commercial consent for Russian, Ukrainian and Spanish", () => {
  for (const locale of ["ru", "uk-UA", "es"]) {
    assert.equal(resolvePromptVoiceModelLoad({ locale }).reason, "non-commercial-consent-required");
    const accepted = resolvePromptVoiceModelLoad({ locale, nonCommercialConsent: true });
    assert.equal(accepted.ok, true);
    assert.equal(accepted.allowNonCommercial, true);
    assert.equal(accepted.localInference, true);
  }
});

test("keeps timestamped Kokoro English-only", () => {
  assert.equal(resolvePromptVoiceModelLoad({ locale: "ru", engineChoice: "timestamped" }).reason, "timestamped-english-only");
  assert.equal(resolvePromptVoiceModelLoad({ locale: "en", engineChoice: "timestamped" }).ok, true);
});

test("rejects missing locale and unsupported engine choices", () => {
  assert.equal(resolvePromptVoiceModelLoad({}).reason, "locale-required");
  assert.equal(resolvePromptVoiceModelLoad({ locale: "en", engineChoice: "cloud" }).reason, "unsupported-engine");
});

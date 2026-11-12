const STAGE_ORDER = ["promptInput", "promptParsing", "storyPlanning", "storyboardValidation", "imageGeneration", "videoGeneration", "voiceGeneration", "lipSync", "export"];
const OPTIONAL_STAGES = new Set(["voiceGeneration", "lipSync"]);
const record = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const text = value => typeof value === "string" ? value.trim() : "";
const normalize = value => text(value).toLocaleLowerCase().normalize("NFKC").replace(/[’']/g, "'").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const words = value => normalize(value).split(/\s+/u).filter(Boolean);
const unique = values => [...new Set(values)];
const hasEvidencePayload = value => {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
};

function compareRequirement(requirement, evidenceText) {
  const expected = unique(words(requirement.evidenceTerms?.length ? requirement.evidenceTerms.join(" ") : requirement.text));
  const actual = new Set(words(evidenceText));
  if (!expected.length) return { status: "not-verifiable", matchedTerms: [], missingTerms: [] };
  const matchedTerms = expected.filter(term => actual.has(term));
  const missingTerms = expected.filter(term => !actual.has(term));
  const ratio = matchedTerms.length / expected.length;
  return { status: ratio === 1 ? "text-evidence-found" : ratio > 0 ? "partial-text-evidence" : "no-text-evidence", matchedTerms, missingTerms };
}

/**
 * Independent, read-only observer for one DRAVEX generation run.
 * It evaluates supplied runtime traces and evidence; it never changes generation.
 * Text matching is lexical only. Visual/audio claims require explicit external assessments.
 */
export function createGenerationObserver({ runId = "", prompt = "", requirements = [] } = {}) {
  const stages = Object.create(null);
  const artifacts = [];
  const assessments = [];
  const safeRequirements = Array.isArray(requirements) ? requirements.filter(item => text(item?.text)) : [];
  function recordStage(name, event = {}) {
    if (!STAGE_ORDER.includes(name)) throw new TypeError(`Unknown generation stage: ${name}`);
    const status = text(event.status || "unknown").toLowerCase();
    stages[name] = {
      status,
      timestamp: text(event.timestamp) || null,
      input: event.input ?? null,
      output: event.output ?? null,
      error: text(event.error) || null,
      evidenceRefs: Array.isArray(event.evidenceRefs) ? event.evidenceRefs.filter(value => typeof value === "string") : []
    };
    return snapshot();
  }
  function attachArtifact(artifact = {}) {
    const kind = text(artifact.kind);
    if (!kind) throw new TypeError("Artifact kind is required.");
    const item = {
      kind,
      name: text(artifact.name) || null,
      mimeType: text(artifact.mimeType) || null,
      sizeBytes: Number.isFinite(Number(artifact.sizeBytes)) && Number(artifact.sizeBytes) >= 0 ? Number(artifact.sizeBytes) : null,
      durationSeconds: Number.isFinite(Number(artifact.durationSeconds)) && Number(artifact.durationSeconds) >= 0 ? Number(artifact.durationSeconds) : null,
      reference: text(artifact.reference) || null,
      evidenceType: text(artifact.evidenceType) || "metadata-only"
    };
    artifacts.push(item);
    return item;
  }
  function recordAssessment(assessment = {}) {
    const target = text(assessment.target);
    const method = text(assessment.method);
    const verdict = text(assessment.verdict).toLowerCase();
    if (!target || !method || !["pass", "partial", "fail", "not-verifiable"].includes(verdict)) {
      throw new TypeError("Assessment needs target, method, and a supported verdict.");
    }
    const evidenceRefs = unique((Array.isArray(assessment.evidenceRefs) ? assessment.evidenceRefs : []).map(text).filter(Boolean));
    const hasEvidence = evidenceRefs.length > 0;
    const summary = text(assessment.summary);
    const item = {
      target, method,
      verdict: hasEvidence ? verdict : "not-verifiable",
      summary: hasEvidence ? summary : [summary, "No evidence references supplied; verdict is not verifiable."].filter(Boolean).join(" "),
      evidenceRefs
    };
    assessments.push(item);
    return item;
  }
  function snapshot() {
    return { schemaVersion: 1, runId: text(runId), prompt: text(prompt), requirements: safeRequirements.map(item => ({ id: text(item.id) || null, category: text(item.category) || "general", text: text(item.text), evidenceTerms: Array.isArray(item.evidenceTerms) ? item.evidenceTerms : [] })), stages: structuredCloneSafe(stages), artifacts: artifacts.map(item => ({ ...item })), assessments: assessments.map(item => ({ ...item })) };
  }
  function report({ interpretation = "", scenes = [], characterPresenceTimeline = [] } = {}) {
    const run = snapshot();
    const interpretationText = typeof interpretation === "string" ? interpretation : JSON.stringify(interpretation ?? {});
    const sceneText = Array.isArray(scenes) ? scenes.map(scene => JSON.stringify(scene)).join(" ") : "";
    const textEvidence = compareEvidence(run.requirements, interpretationText, sceneText);
    const stageResults = STAGE_ORDER.map(stage => {
      const item = record(run.stages[stage]);
      const status = item.status || "unknown";
      const hasEvidence = hasEvidencePayload(item.output) || (Array.isArray(item.evidenceRefs) && item.evidenceRefs.length > 0);
      const verdict = ["completed", "success", "passed"].includes(status) && hasEvidence ? "evidence-recorded"
        : ["failed", "error"].includes(status) ? "failed"
        : ["running", "pending"].includes(status) ? "pending"
        : ["skipped", "disabled", "not-configured"].includes(status) && OPTIONAL_STAGES.has(stage) ? "optional"
        : "not-verifiable";
      return { stage, status, verdict, error: item.error || null, evidenceRefs: item.evidenceRefs || [] };
    });
    const visualChecks = run.assessments.filter(item => /image|video|motion|character|visual|frame|playback|audio|lip.?sync/i.test(item.target));
    const failures = textEvidence.filter(item => item.status === "no-text-evidence");
    const partial = textEvidence.filter(item => item.status === "partial-text-evidence");
    return {
      schemaVersion: 1, runId: run.runId, prompt: run.prompt,
      requirementChecks: textEvidence,
      stageResults,
      artifacts: run.artifacts,
      characterPresenceTimeline: Array.isArray(characterPresenceTimeline) ? characterPresenceTimeline : [],
      mediaAssessments: visualChecks,
      summary: {
        requirementCount: textEvidence.length,
        textEvidenceFound: textEvidence.filter(item => item.status === "text-evidence-found").length,
        partialTextEvidence: partial.length,
        noTextEvidence: failures.length,
        failedStages: stageResults.filter(item => item.verdict === "failed").length,
        unverifiedStages: stageResults.filter(item => item.verdict === "not-verifiable").length,
        mediaAssessments: visualChecks.length,
        overall: failures.length || stageResults.some(item => item.verdict === "failed") || visualChecks.some(item => item.verdict === "fail") ? "issues-found"
          : textEvidence.length === 0 || stageResults.some(item => item.verdict === "not-verifiable" || item.verdict === "pending") || visualChecks.some(item => item.verdict === "not-verifiable") ? "incomplete-evidence"
          : partial.length || visualChecks.some(item => item.verdict === "partial") ? "partially-verified"
          : "evidence-recorded-not-quality-certified"
      },
      limitations: [
        "Requirement matching is lexical and does not prove semantic understanding.",
        "Artifact metadata does not prove that images look correct or video contains real motion.",
        "Visual, audio, and playback verdicts are accepted only as explicit assessments with evidence references.",
        "The observer is read-only and does not repair code, prompts, or generated media."
      ]
    };
  }
  return Object.freeze({ recordStage, attachArtifact, recordAssessment, snapshot, report });
}
function compareEvidence(requirements, interpretation, scenes) {
  const combined = `${interpretation} ${scenes}`;
  return requirements.map(requirement => ({ id: requirement.id || null, category: requirement.category || "general", requirement: requirement.text, ...compareRequirement(requirement, combined) }));
}
function structuredCloneSafe(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
export { STAGE_ORDER as GENERATION_OBSERVER_STAGES };

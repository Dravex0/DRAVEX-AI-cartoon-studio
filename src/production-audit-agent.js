const STAGES = ["promptInput", "promptParsing", "storyPlanning", "storyboardValidation", "imageGeneration", "videoGeneration", "voiceGeneration", "lipSync", "export"];
const OPTIONAL_STAGES = new Set(["voiceGeneration", "lipSync"]);
const asRecord = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const hasPayload = value => {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value && typeof value === "object" && Object.keys(value).length);
};

/** Audits supplied run records; does not execute generation or inspect rendered media. */
export function auditProductionRun(rawRun = {}) {
  const run = asRecord(rawRun), stages = asRecord(run.stages), artifacts = asRecord(run.artifacts);
  const results = [], issues = [];
  for (const name of STAGES) {
    const stage = asRecord(stages[name]), status = String(stage.status ?? "unknown").toLowerCase();
    const optional = OPTIONAL_STAGES.has(name);
    let verdict = "unknown", message = "No execution evidence was supplied for this stage.";
    if (["completed", "success", "passed"].includes(status)) {
      if (hasPayload(stage.output) || hasPayload(artifacts[name])) { verdict = "passed"; message = "Stage reports completion and includes output evidence."; }
      else { verdict = "warning"; message = "Stage reports completion but provides no output evidence."; }
    } else if (["failed", "error"].includes(status)) { verdict = "failed"; message = String(stage.error || "Stage reported a failure."); }
    else if (["skipped", "disabled", "not-configured"].includes(status)) {
      const textToVideoImageSkip = name === "imageGeneration" && status === "skipped"
        && /text-to-video/i.test(String(stage.output?.reason ?? ""));
      const isOptional = optional || textToVideoImageSkip;
      verdict = isOptional ? "optional" : "warning";
      message = textToVideoImageSkip
        ? "Image generation was not needed for the explicitly identified text-to-video path."
        : isOptional ? "Optional stage was not run." : "Required stage was skipped.";
    } else if (["running", "pending"].includes(status)) { verdict = "pending"; message = "Stage has not produced a final result yet."; }
    results.push({ stage: name, status, verdict, message });
    if (verdict === "failed") issues.push({ severity: "error", code: "stage-failed", stage: name, message });
    else if (verdict === "warning") issues.push({ severity: "warning", code: "stage-evidence-missing-or-skipped", stage: name, message });
    else if (verdict === "unknown" || verdict === "pending") issues.push({ severity: "info", code: "stage-not-verified", stage: name, message });
  }
  const exportRecord = asRecord(artifacts.export ?? stages.export?.output);
  const exportVerified = typeof exportRecord.filename === "string" && exportRecord.filename.trim()
    && Number.isFinite(Number(exportRecord.sizeBytes)) && Number(exportRecord.sizeBytes) > 0;
  if (results.find(item => item.stage === "export")?.verdict === "passed" && !exportVerified) {
    issues.push({ severity: "warning", code: "export-file-not-independently-verified", stage: "export",
      message: "Export lacks both filename and positive file size; file integrity and playback remain unverified." });
  }
  const failedCount = results.filter(item => item.verdict === "failed").length;
  const warningCount = issues.filter(item => item.severity === "warning").length;
  const unknownCount = results.filter(item => ["unknown", "pending"].includes(item.verdict)).length;
  const complete = results.every(item => OPTIONAL_STAGES.has(item.stage) || item.verdict === "passed")
    && failedCount === 0 && unknownCount === 0 && warningCount === 0;
  return {
    schemaVersion: 1, runId: String(run.runId ?? "").slice(0, 120), stageCount: STAGES.length,
    results, issues, summary: { failedCount, warningCount, unknownCount, complete },
    limitations: [
      "Checks only execution records and artifact metadata supplied to the auditor.",
      "Does not independently parse browser prompts, inspect pixels, listen to audio, or decode/play video.",
      "A successful stage status is not proof of visual quality or semantic correctness."
    ]
  };
}
export { STAGES as PRODUCTION_AUDIT_STAGES };

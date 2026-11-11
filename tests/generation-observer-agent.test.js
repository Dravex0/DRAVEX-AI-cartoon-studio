import test from "node:test";
import assert from "node:assert/strict";
import { createGenerationObserver, GENERATION_OBSERVER_STAGES } from "../src/generation-observer-agent.js";

test("observer records a full run without mutating supplied output", () => {
  const output = { scenes: [{ action: "Kel runs" }] };
  const observer = createGenerationObserver({ runId: "kel-medium-01", prompt: "Kel runs through a forest", requirements: [{ id: "hero", category: "character", text: "Kel remains the same character", evidenceTerms: ["Kel", "same", "character"] }] });
  observer.recordStage("promptInput", { status: "completed", output: "Kel runs through a forest" });
  observer.recordStage("promptParsing", { status: "completed", output: { character: "Kel" } });
  observer.recordStage("storyPlanning", { status: "completed", output });
  observer.recordStage("imageGeneration", { status: "completed", output: ["frame-1"] });
  observer.attachArtifact({ kind: "image", name: "frame-1.png", sizeBytes: 1234, reference: "artifact://frame-1" });
  const report = observer.report({ interpretation: "Kel is the main character", scenes: output.scenes });
  assert.equal(report.runId, "kel-medium-01");
  assert.equal(report.requirementChecks[0].status, "partial-text-evidence");
  assert.equal(report.artifacts[0].sizeBytes, 1234);
  assert.deepEqual(output, { scenes: [{ action: "Kel runs" }] });
});

test("missing evidence is never treated as success", () => {
  const observer = createGenerationObserver({ prompt: "A medium complexity cartoon", requirements: [{ text: "three scenes and dialogue", evidenceTerms: ["three", "scenes", "dialogue"] }] });
  const report = observer.report();
  assert.equal(report.requirementChecks[0].status, "no-text-evidence");
  assert.equal(report.summary.overall, "issues-found");
  assert.equal(report.stageResults[0].verdict, "not-verifiable");
});

test("visual claims require explicit assessments and artifact metadata is not visual proof", () => {
  const observer = createGenerationObserver();
  observer.attachArtifact({ kind: "video", name: "film.webm", sizeBytes: 5000, durationSeconds: 12 });
  let report = observer.report();
  assert.equal(report.mediaAssessments.length, 0);
  assert.equal(report.summary.overall, "incomplete-evidence");
  observer.recordAssessment({ target: "video-motion", method: "frame-sampling", verdict: "pass", summary: "Movement observed", evidenceRefs: ["frame-samples://1"] });
  report = observer.report();
  assert.equal(report.mediaAssessments[0].verdict, "pass");
});

test("only declared generation stages can be recorded", () => {
  const observer = createGenerationObserver();
  assert.throws(() => observer.recordStage("imaginaryStage", { status: "completed" }), /Unknown generation stage/);
  assert.equal(GENERATION_OBSERVER_STAGES.length, 9);
});

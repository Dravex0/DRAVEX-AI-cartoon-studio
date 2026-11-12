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

test("unknown voice and lip-sync provenance remains unverified rather than successful", () => {
  const observer = createGenerationObserver();
  observer.recordStage("voiceGeneration", { status: "unknown", output: { trackCount: 2, includedInExport: true, provenance: "not-tracked" } });
  observer.recordStage("lipSync", { status: "unknown", output: { eligibleTrackCount: 2, analyzedTrackCount: 0, appliedToExport: false } });
  const report = observer.report();
  assert.equal(report.stageResults.find(item => item.stage === "voiceGeneration").verdict, "not-verifiable");
  assert.equal(report.stageResults.find(item => item.stage === "lipSync").verdict, "not-verifiable");
  assert.equal(report.summary.unverifiedStages, 9);
  assert.equal(report.stageResults.find(item => item.stage === "voiceGeneration").status, "unknown");
  assert.equal(report.stageResults.find(item => item.stage === "lipSync").status, "unknown");
  assert.equal(report.summary.overall, "incomplete-evidence");
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

test("observer report can include a character presence timeline without treating it as visual proof", () => {
  const observer = createGenerationObserver({ runId: "presence-test" });
  const timeline = [{ sceneId: "scene-2", cameraCut: true, characters: [{ characterId: "Kel", status: "offscreen" }] }];
  const report = observer.report({ characterPresenceTimeline: timeline });
  assert.deepEqual(report.characterPresenceTimeline, timeline);
  assert.equal(report.mediaAssessments.length, 0);
});

test("only declared generation stages can be recorded", () => {
  const observer = createGenerationObserver();
  assert.throws(() => observer.recordStage("imaginaryStage", { status: "completed" }), /Unknown generation stage/);
  assert.equal(GENERATION_OBSERVER_STAGES.length, 9);
});


test("observer tokenizes Unicode text and whitespace correctly", () => {
  const observer = createGenerationObserver({
    prompt: "Кель идёт через лес",
    requirements: [{ text: "Кель идёт через лес", evidenceTerms: ["КЕЛЬ", "идёт", "лес"] }]
  });
  const report = observer.report({ interpretation: "Кель   идёт\nчерез лес" });
  assert.equal(report.requirementChecks[0].status, "text-evidence-found");
  assert.deepEqual(report.requirementChecks[0].missingTerms, []);
});

test("a pending required stage keeps the overall report incomplete", () => {
  const observer = createGenerationObserver({
    prompt: "Kel helps a small bird",
    requirements: [{ id: "hero", text: "Kel", evidenceTerms: ["Kel"] }]
  });
  for (const stage of GENERATION_OBSERVER_STAGES) {
    if (stage === "videoGeneration") {
      observer.recordStage(stage, { status: "pending" });
    } else if (stage === "voiceGeneration" || stage === "lipSync") {
      observer.recordStage(stage, { status: "not-configured" });
    } else {
      observer.recordStage(stage, { status: "completed", output: { artifactId: stage } });
    }
  }
  const report = observer.report({ interpretation: "Kel helps a bird" });
  assert.equal(report.stageResults.find(item => item.stage === "videoGeneration").verdict, "pending");
  assert.equal(report.summary.overall, "incomplete-evidence");
});

test("an empty output object is not accepted as completed stage evidence", () => {
  const observer = createGenerationObserver();
  observer.recordStage("videoGeneration", { status: "completed", output: {} });
  const report = observer.report();
  const stage = report.stageResults.find(item => item.stage === "videoGeneration");
  assert.equal(stage.verdict, "not-verifiable");
  assert.equal(report.summary.unverifiedStages, 9);
  assert.equal(report.summary.overall, "incomplete-evidence");
});

import test from "node:test";
import assert from "node:assert/strict";
import { auditProductionRun, PRODUCTION_AUDIT_STAGES } from "../src/production-audit-agent.js";

test("covers the prompt-to-export pipeline", () => {
  assert.deepEqual(PRODUCTION_AUDIT_STAGES, ["promptInput", "promptParsing", "storyPlanning", "storyboardValidation", "imageGeneration", "videoGeneration", "voiceGeneration", "lipSync", "export"]);
});
test("does not claim completion when stages have no evidence", () => {
  const report = auditProductionRun({});
  assert.equal(report.summary.complete, false);
  assert.equal(report.summary.unknownCount, 9);
});
test("reports failed generation and skipped required stages", () => {
  const report = auditProductionRun({ stages: {
    promptInput: { status: "completed", output: "A fox enters a forest" },
    promptParsing: { status: "completed", output: { prompt: "A fox enters a forest" } },
    storyPlanning: { status: "completed", output: [{ id: "s1" }] },
    storyboardValidation: { status: "completed", output: { ok: true } },
    imageGeneration: { status: "failed", error: "provider timeout" },
    videoGeneration: { status: "skipped" }
  }});
  assert.ok(report.issues.some(issue => issue.code === "stage-failed" && issue.stage === "imageGeneration"));
  assert.ok(report.issues.some(issue => issue.code === "stage-evidence-missing-or-skipped" && issue.stage === "videoGeneration"));
  assert.equal(report.summary.complete, false);
});
test("optional voice stages may be skipped", () => {
  const report = auditProductionRun({ stages: {
    promptInput: { status: "completed", output: "prompt" }, promptParsing: { status: "completed", output: { prompt: "prompt" } },
    storyPlanning: { status: "completed", output: [{ id: "s1" }] }, storyboardValidation: { status: "completed", output: { ok: true } },
    imageGeneration: { status: "completed", output: { imageId: "img-1" } }, videoGeneration: { status: "completed", output: { clipId: "clip-1" } },
    voiceGeneration: { status: "skipped" }, lipSync: { status: "not-configured" },
    export: { status: "completed", output: { filename: "film.webm", sizeBytes: 1024 } }
  }});
  assert.equal(report.summary.failedCount, 0);
  assert.equal(report.results.find(item => item.stage === "voiceGeneration").verdict, "optional");
  assert.equal(report.summary.complete, true);
});
test("does not claim export verified without file metadata", () => {
  const report = auditProductionRun({ stages: { export: { status: "completed", output: { url: "blob:example" } } } });
  assert.ok(report.issues.some(issue => issue.code === "export-file-not-independently-verified"));
});

test("an explicit text-to-video path may skip still-image generation", () => {
  const report = auditProductionRun({ stages: {
    promptInput: { status: "completed", output: "A fox runs through a forest" },
    promptParsing: { status: "completed", output: { prompt: "A fox runs through a forest" } },
    storyPlanning: { status: "completed", output: [{ id: "s1" }] },
    storyboardValidation: { status: "completed", output: { ok: true } },
    imageGeneration: { status: "skipped", output: { reason: "ComfyUI text-to-video path did not require generated still images." } },
    videoGeneration: { status: "completed", output: { clipId: "clip-1" } },
    voiceGeneration: { status: "skipped" },
    lipSync: { status: "not-configured" },
    export: { status: "completed", output: { filename: "film.webm", sizeBytes: 1024 } }
  }});
  const imageStage = report.results.find(item => item.stage === "imageGeneration");
  assert.equal(imageStage.verdict, "optional");
  assert.match(imageStage.message, /not needed for the explicitly identified text-to-video path/);
  assert.equal(report.summary.complete, true);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createGenerationObserver } from "../src/generation-observer-agent.js";
import { recordSceneMotionAssessment } from "../src/generation-observer-media-bridge.js";

test("decoded frame changes are recorded as partial evidence, not semantic action proof", () => {
  const observer = createGenerationObserver({ runId: "run-1" });
  const assessment = recordSceneMotionAssessment(observer, {
    runId: "run-1",
    sceneId: "scene-2",
    result: { status: "visible-change", meanPixelChange: 0.12, changedPixelRatio: 0.24 },
    frameSamples: [{ time: 0.2, dataUrl: "data:image/jpeg;base64,AA==" }]
  });
  assert.equal(assessment.verdict, "partial");
  assert.deepEqual(assessment.evidenceRefs, ["scene-motion://run-1/scene-2"]);
  const report = observer.report();
  assert.equal(report.mediaAssessments.length, 1);
  assert.equal(report.mediaAssessments[0].verdict, "partial");
  assert.match(report.mediaAssessments[0].summary, /does not identify which object moved/);
  assert.equal(report.artifacts[0].evidenceType, "decoded-video-frame-sampling");
});

test("missing frame samples cannot create a media assessment", () => {
  const observer = createGenerationObserver({ runId: "run-2" });
  const assessment = recordSceneMotionAssessment(observer, {
    runId: "run-2",
    sceneId: "scene-1",
    result: { status: "visible-change" },
    frameSamples: []
  });
  assert.equal(assessment, null);
  assert.equal(observer.report().mediaAssessments.length, 0);
});

test("low pixel change remains not-verifiable rather than a false pass", () => {
  const observer = createGenerationObserver({ runId: "run-3" });
  const assessment = recordSceneMotionAssessment(observer, {
    runId: "run-3",
    sceneId: "scene-1",
    result: { status: "likely-static", meanPixelChange: 0.001, changedPixelRatio: 0.002 },
    frameSamples: [{ time: 0.5, dataUrl: "data:image/jpeg;base64,AA==" }]
  });
  assert.equal(assessment.verdict, "not-verifiable");
});

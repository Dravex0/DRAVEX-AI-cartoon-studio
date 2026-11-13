/**
 * Connects decoded-frame motion measurements to the generation observer.
 * A pixel-change heuristic is deliberately reported as partial evidence,
 * never as proof that the requested character action was performed.
 */
export function recordSceneMotionAssessment(observer, {
  runId = "",
  sceneId = "",
  result = {},
  frameSamples = []
} = {}) {
  if (!observer || typeof observer.attachArtifact !== "function" ||
      typeof observer.recordAssessment !== "function") return null;
  const safeSceneId = String(sceneId || "").trim();
  if (!safeSceneId || !Array.isArray(frameSamples) || frameSamples.length === 0) return null;
  const reference = `scene-motion://${encodeURIComponent(String(runId || "run"))}/${encodeURIComponent(safeSceneId)}`;
  observer.attachArtifact({
    kind: "decoded-frame-samples",
    name: `motion-evidence-${safeSceneId}.json`,
    mimeType: "application/json",
    reference,
    evidenceType: "decoded-video-frame-sampling"
  });
  const visibleChange = result.status === "visible-change";
  return observer.recordAssessment({
    target: `video-motion-${safeSceneId}`,
    method: "browser-local-luminance-frame-difference",
    verdict: visibleChange ? "partial" : "not-verifiable",
    summary: visibleChange
      ? `Decoded frame samples show pixel changes (mean change ${Number(result.meanPixelChange || 0)}; changed-pixel ratio ${Number(result.changedPixelRatio || 0)}). This does not identify which object moved or prove the requested action.`
      : "Decoded frame samples were captured, but the pixel-change heuristic did not establish visible motion. This does not prove the clip is semantically static.",
    evidenceRefs: [reference]
  });
}

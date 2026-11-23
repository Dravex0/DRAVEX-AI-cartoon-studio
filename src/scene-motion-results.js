/**
 * Summarize browser-local scene motion outcomes.
 * "checked" counts only clips with a completed pixel-change analysis.
 * Skipped clips are reported separately; unknown statuses are ignored.
 */
export function summarizeSceneMotionResults(results) {
  const values = results instanceof Map ? [...results.values()] : Array.isArray(results) ? results : [];
  const summary = values.reduce((counts, result) => {
    if (result?.status === "likely-static") counts.static += 1;
    else if (result?.status === "visible-change") counts.changed += 1;
    else if (result?.status === "skipped") counts.skipped += 1;
    return counts;
  }, { static: 0, changed: 0, skipped: 0 });
  const motionTracks = values.reduce((sum, result) => sum + (Number.isFinite(result?.motionTrackCount) ? result.motionTrackCount : 0), 0);
  const persistentMotionTracks = values.reduce((sum, result) => sum + (Number.isFinite(result?.persistentMotionTrackCount) ? result.persistentMotionTrackCount : 0), 0);
  const motionRegionObservations = values.reduce((sum, result) => sum + (Number.isFinite(result?.motionRegionObservations) ? result.motionRegionObservations : 0), 0);
  return { checked: summary.static + summary.changed, ...summary, motionTracks, persistentMotionTracks, motionRegionObservations };
}

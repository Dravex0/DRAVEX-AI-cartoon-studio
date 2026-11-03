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
  return { checked: summary.static + summary.changed, ...summary };
}

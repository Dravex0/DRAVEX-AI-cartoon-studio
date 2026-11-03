/**
 * Summarize browser-local scene motion results without interpreting animation quality.
 * Results may be a Map keyed by scene ID or an array of result objects.
 */
export function summarizeSceneMotionResults(results) {
  const values = results instanceof Map ? [...results.values()] : Array.isArray(results) ? results : [];
  return values.reduce((summary, result) => {
    if (result?.status === "likely-static") summary.static += 1;
    else if (result?.status === "visible-change") summary.changed += 1;
    else if (result?.status === "skipped") summary.skipped += 1;
    return summary;
  }, { checked: 0, static: 0, changed: 0, skipped: 0 });
}

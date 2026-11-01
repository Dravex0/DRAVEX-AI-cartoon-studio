/**
 * Normalize provider progress values to a 0–100 percentage.
 * Gradio commonly reports fractions (0–1); other providers may report 0–100.
 */
export function normalizeVideoProgressPercent(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const percent = value >= 0 && value <= 1 ? value * 100 : value;
  return Math.round(Math.max(0, Math.min(100, percent)));
}

/**
 * Read progress only when a provider actually reports a numeric value.
 * Queue position and elapsed time are deliberately not treated as percentages.
 */
export function readVideoProgressPercent(update) {
  if (!update || typeof update !== "object") return null;

  const directKeys = ["progressPercent", "percentage", "percent", "progress"];
  for (const key of directKeys) {
    const value = normalizeVideoProgressPercent(update[key]);
    if (value !== null) return value;
  }

  const progressEntries = [
    ...(Array.isArray(update.progress_data) ? update.progress_data : []),
    ...(Array.isArray(update.progressData) ? update.progressData : []),
    ...(Array.isArray(update.progress) ? update.progress : [])
  ];

  for (let index = progressEntries.length - 1; index >= 0; index -= 1) {
    const entry = progressEntries[index];
    if (!entry || typeof entry !== "object") continue;
    for (const key of ["progress", "percentage", "percent"]) {
      const value = normalizeVideoProgressPercent(entry[key]);
      if (value !== null) return value;
    }
  }

  return null;
}

const abortError = () => {
  const error = new Error("Storyboard video generation was cancelled.");
  error.name = "AbortError";
  return error;
};

/**
 * Generate scene clips sequentially so browser memory and local GPU pressure stay bounded.
 * The caller owns provider configuration, persistence, and final export.
 */
export async function generateStoryboardVideos({
  scenes,
  generateScene,
  hasVideo = () => false,
  onProgress = () => {},
  signal
} = {}) {
  if (!Array.isArray(scenes) || scenes.length === 0) {
    throw new TypeError("At least one storyboard scene is required.");
  }
  if (typeof generateScene !== "function") {
    throw new TypeError("generateScene must be a function.");
  }
  if (typeof hasVideo !== "function" || typeof onProgress !== "function") {
    throw new TypeError("hasVideo and onProgress must be functions.");
  }

  const notifyProgress = update => {
    try { onProgress(update); } catch { /* UI progress must not change generation results. */ }
  };

  const report = {
    total: scenes.length,
    completed: 0,
    skipped: 0,
    failed: 0,
    results: []
  };

  for (let index = 0; index < scenes.length; index += 1) {
    if (signal?.aborted) {
      report.cancelled = true;
      break;
    }

    const scene = scenes[index];
    if (hasVideo(scene, index)) {
      report.skipped += 1;
      report.results.push({ index, status: "skipped" });
      notifyProgress({ ...report, currentIndex: index, stage: "skipped" });
      continue;
    }

    notifyProgress({ ...report, currentIndex: index, stage: "starting" });
    try {
      const result = await generateScene(scene, index, { signal });
      if (signal?.aborted) throw abortError();
      if (!result || result.status !== "completed") {
        throw new Error("Scene provider did not return a completed video.");
      }
      report.completed += 1;
      report.results.push({ index, status: "completed", result });
      notifyProgress({ ...report, currentIndex: index, stage: "completed" });
    } catch (error) {
      if (error?.name === "AbortError" || signal?.aborted) {
        report.cancelled = true;
        break;
      }
      report.failed += 1;
      report.results.push({
        index,
        status: "failed",
        error: String(error?.message || "Unknown scene generation error")
      });
      notifyProgress({ ...report, currentIndex: index, stage: "failed" });
    }
  }

  return report;
}

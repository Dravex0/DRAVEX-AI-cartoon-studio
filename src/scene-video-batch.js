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
      onProgress({ ...report, currentIndex: index, stage: "skipped" });
      continue;
    }

    onProgress({ ...report, currentIndex: index, stage: "starting" });
    try {
      const result = await generateScene(scene, index, { signal });
      if (signal?.aborted) throw abortError();
      if (!result || result.status !== "completed") {
        throw new Error("Scene provider did not return a completed video.");
      }
      report.completed += 1;
      report.results.push({ index, status: "completed", result });
      onProgress({ ...report, currentIndex: index, stage: "completed" });
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
      onProgress({ ...report, currentIndex: index, stage: "failed" });
    }
  }

  return report;
}

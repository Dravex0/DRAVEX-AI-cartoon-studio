const DEFAULT_SAMPLE_INTERVAL_MS = 500;
const DEFAULT_MAX_FRAMES = 1800;
const MAX_ERROR_MESSAGES = 20;

function makeAbortError() {
  const error = new Error("Face video analysis was cancelled.");
  error.name = "AbortError";
  return error;
}

function closeFrame(frame) {
  try { frame?.close?.(); } catch { /* A transferred ImageBitmap may already be detached. */ }
}

function notify(callback, payload) {
  try { callback(payload); } catch { /* UI callbacks must not break media processing. */ }
}

/**
 * Analyze a video through an injected sequential frame-capture function.
 *
 * captureFrame(timestampMs, { signal }) must resolve to a transferable ImageBitmap.
 * The bitmap is transferred to the worker and closed on the worker side. If transfer
 * never occurs (for example, cancellation or a disposed client), this module closes it.
 *
 * This orchestration layer deliberately does not seek or decode media itself. That keeps
 * browser-specific video seeking in the app adapter and makes sequencing/cancellation
 * behavior testable without a real browser.
 */
export async function analyzeFaceVideoFrames({
  durationMs,
  captureFrame,
  workerClient,
  sampleIntervalMs = DEFAULT_SAMPLE_INTERVAL_MS,
  startTimeMs = 0,
  maxFrames = DEFAULT_MAX_FRAMES,
  signal,
  onProgress = () => {},
  onCheckpoint = () => {},
  onFrameResult = () => {}
} = {}) {
  const duration = Number(durationMs);
  const interval = Number(sampleIntervalMs);
  const start = Number(startTimeMs);
  const limit = Number(maxFrames);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new RangeError("durationMs must be a positive finite number.");
  }
  if (typeof captureFrame !== "function") {
    throw new TypeError("captureFrame must be a function that returns an ImageBitmap.");
  }
  if (!workerClient || typeof workerClient.processFrame !== "function") {
    throw new TypeError("An initialized face landmark worker client is required.");
  }
  if (!Number.isFinite(interval) || interval < 100 || interval > 10000) {
    throw new RangeError("sampleIntervalMs must be between 100 and 10000.");
  }
  if (!Number.isFinite(start) || start < 0 || start >= duration) {
    throw new RangeError("startTimeMs must be within the video duration.");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000) {
    throw new RangeError("maxFrames must be an integer between 1 and 10000.");
  }
  if (typeof onProgress !== "function" || typeof onCheckpoint !== "function" ||
      typeof onFrameResult !== "function") {
    throw new TypeError("onProgress, onCheckpoint, and onFrameResult must be functions.");
  }
  if (signal?.aborted) throw makeAbortError();

  const total = Math.ceil((duration - start) / interval);
  if (total > limit) {
    throw new RangeError(`This analysis needs ${total} frames, exceeding maxFrames (${limit}). Increase the interval or process a shorter clip.`);
  }

  const report = {
    status: "running",
    total,
    processed: 0,
    detected: 0,
    noFace: 0,
    invalidLandmarks: 0,
    failed: 0,
    lastTimestampMs: null,
    nextTimestampMs: start,
    cancelled: false,
    errors: []
  };

  for (let index = 0; index < total; index += 1) {
    if (signal?.aborted) {
      report.cancelled = true;
      break;
    }
    if (workerClient.isDisposed) {
      report.status = "worker-unavailable";
      report.errors.push("Face landmark worker is no longer available.");
      break;
    }

    const timestampMs = start + index * interval;
    let frame = null;
    let transferred = false;
    try {
      frame = await captureFrame(timestampMs, { signal });
      if (signal?.aborted) throw makeAbortError();
      if (!frame || typeof frame.close !== "function") {
        throw new TypeError("captureFrame must return a transferable ImageBitmap.");
      }

      // processFrame transfers ownership only after validating the timestamp and client state.
      try {
        const result = await workerClient.processFrame(frame, timestampMs);
        transferred = true;
        report.processed += 1;
        report.lastTimestampMs = timestampMs;
        report.nextTimestampMs = timestampMs + interval;
        if (result?.status === "face-detected") report.detected += 1;
        else if (result?.status === "no-face") report.noFace += 1;
        else report.invalidLandmarks += 1;
        notify(onFrameResult, {
          timestampMs,
          status: result?.status || "invalid-landmarks",
          faceCount: Number(result?.faceCount) || 0,
          anchors: result?.anchors || null,
          issues: Array.isArray(result?.issues) ? result.issues : []
        });

        const checkpoint = {
          nextTimestampMs: report.nextTimestampMs,
          lastTimestampMs: report.lastTimestampMs,
          processed: report.processed,
          total: report.total
        };
        notify(onCheckpoint, checkpoint);
      } finally {
        // Worker owns and closes a successfully transferred bitmap. Calling close again
        // is safe for ImageBitmap; it also covers a client rejection before transfer.
        closeFrame(frame);
        frame = null;
      }
    } catch (error) {
      if (error?.name === "AbortError" || signal?.aborted) {
        report.cancelled = true;
        break;
      }
      report.failed += 1;
      if (report.errors.length < MAX_ERROR_MESSAGES) {
        report.errors.push({ timestampMs, message: String(error?.message || "Frame analysis failed.") });
      }
      if (workerClient.isDisposed) {
        report.status = "worker-unavailable";
        break;
      }
    } finally {
      if (frame && !transferred) closeFrame(frame);
    }

    notify(onProgress, {
      status: report.status,
      processed: report.processed + report.failed,
      total: report.total,
      detected: report.detected,
      noFace: report.noFace,
      failed: report.failed,
      currentTimestampMs: timestampMs,
      percent: Math.round(((index + 1) / total) * 100)
    });
  }

  if (report.cancelled) report.status = "cancelled";
  else if (report.status === "running") report.status = report.failed ? "completed-with-errors" : "completed";
  return report;
}

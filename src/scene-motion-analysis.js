/**
 * Browser-local motion check for a decoded scene video.
 * Pixel-change heuristic only; it does not recognize semantic actions or quality.
 */
function waitForSeek(video, targetTime, timeoutMs) {
  if (Math.abs(Number(video.currentTime) - targetTime) < 0.015 && !video.seeking) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error(video.error?.message || "Video failed while seeking frames.")); };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    timer = setTimeout(() => { cleanup(); reject(new Error("Timed out while sampling a scene video frame.")); }, timeoutMs);
    try { video.currentTime = targetTime; } catch (error) { cleanup(); reject(error); }
  });
}
function frameLuminance(imageData) {
  const { data, width, height } = imageData;
  const values = new Float32Array(width * height);
  for (let pixel = 0, offset = 0; pixel < values.length; pixel += 1, offset += 4) {
    values[pixel] = (0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2]) / 255;
  }
  return values;
}
function extractMotionRegions(previous, current, width, height, threshold, frameIndex) {
  const changed = new Uint8Array(width * height);
  for (let index = 0; index < changed.length; index += 1) {
    if (Math.abs(current[index] - previous[index]) >= threshold) changed[index] = 1;
  }
  const visited = new Uint8Array(changed.length);
  const queue = new Int32Array(changed.length);
  const regions = [];
  for (let seed = 0; seed < changed.length; seed += 1) {
    if (!changed[seed] || visited[seed]) continue;
    let head = 0, tail = 0, minX = width, minY = height, maxX = -1, maxY = -1;
    let sumX = 0, sumY = 0, sumDelta = 0;
    queue[tail++] = seed; visited[seed] = 1;
    while (head < tail) {
      const index = queue[head++], x = index % width, y = Math.floor(index / width);
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      sumX += x; sumY += y; sumDelta += Math.abs(current[index] - previous[index]);
      const neighbors = [x > 0 ? index - 1 : -1, x + 1 < width ? index + 1 : -1,
        y > 0 ? index - width : -1, y + 1 < height ? index + width : -1];
      for (const next of neighbors) {
        if (next >= 0 && changed[next] && !visited[next]) {
          visited[next] = 1; queue[tail++] = next;
        }
      }
    }
    if (tail < 2) continue;
    regions.push({
      frameIndex,
      area: tail,
      centroid: { x: Number((sumX / tail / width).toFixed(4)), y: Number((sumY / tail / height).toFixed(4)) },
      bounds: { x: minX / width, y: minY / height,
        width: (maxX - minX + 1) / width, height: (maxY - minY + 1) / height },
      meanDelta: Number((sumDelta / tail).toFixed(5))
    });
  }
  return regions.sort((a, b) => b.area - a.area).slice(0, 12);
}

function linkMotionRegions(regionFrames) {
  const tracks = [];
  regionFrames.forEach((regions, frameIndex) => {
    const claimed = new Set();
    for (const region of regions) {
      let best = null, bestDistance = Infinity;
      for (const track of tracks) {
        const previous = track.observations.at(-1);
        if (previous.frameIndex !== frameIndex - 1 || claimed.has(track.id)) continue;
        const distance = Math.hypot(region.centroid.x - previous.centroid.x,
          region.centroid.y - previous.centroid.y);
        if (distance < bestDistance && distance <= 0.24) { best = track; bestDistance = distance; }
      }
      if (!best) {
        best = { id: 'motion-' + (tracks.length + 1), observations: [] };
        tracks.push(best);
      }
      best.observations.push(region);
      claimed.add(best.id);
    }
  });
  return tracks.map(track => {
    const first = track.observations[0], last = track.observations.at(-1);
    return {
      id: track.id,
      observations: track.observations,
      displacement: {
        x: Number((last.centroid.x - first.centroid.x).toFixed(4)),
        y: Number((last.centroid.y - first.centroid.y).toFixed(4))
      },
      persistence: track.observations.length
    };
  });
}

/**
 * Samples small frames locally and compares adjacent-frame luminance.
 * @returns {Promise<{status:string,sampleCount:number,meanPixelChange:number,changedPixelRatio:number,message:string}>}
 */
export async function analyzeSceneVideoMotion(video, {
  sampleCount = 5, width = 32, height = 32, pixelDeltaThreshold = 0.06,
  staticMotionThreshold = 0.008, changedPixelThreshold = 0.01,
  timeoutMs = 5000, canvasFactory = () => document.createElement("canvas")
} = {}) {
  if (!video || typeof video.addEventListener !== "function" || typeof video.removeEventListener !== "function") {
    throw new TypeError("video must be an HTMLVideoElement-like event target.");
  }
  if (!Number.isInteger(sampleCount) || sampleCount < 2 || sampleCount > 12) {
    throw new RangeError("sampleCount must be an integer from 2 to 12.");
  }
  if (![width, height].every(value => Number.isInteger(value) && value > 0 && value <= 128)) {
    throw new RangeError("Frame analysis dimensions must be integers from 1 to 128.");
  }
  if (!Number.isFinite(Number(video.duration)) || video.duration <= 0 ||
      !Number.isFinite(Number(video.videoWidth)) || video.videoWidth <= 0 || video.readyState < 2) {
    throw new Error("Scene video must have a decoded frame and a finite duration.");
  }
  if (typeof canvasFactory !== "function") throw new TypeError("canvasFactory must be a function.");
  const canvas = canvasFactory();
  const context = canvas?.getContext?.("2d", { willReadFrequently: true });
  if (!canvas || !context || typeof context.drawImage !== "function" || typeof context.getImageData !== "function") {
    throw new Error("A readable 2D canvas is required for local motion analysis.");
  }
  canvas.width = width;
  canvas.height = height;
  const wasPaused = Boolean(video.paused);
  const originalTime = Number(video.currentTime) || 0;
  const frames = [];
  const sampleTimes = [];
  video.pause?.();
  try {
    for (let index = 0; index < sampleCount; index += 1) {
      const fraction = 0.08 + (0.84 * index) / (sampleCount - 1);
      const targetTime = Math.min(Math.max(0, video.duration - 0.01), video.duration * fraction);
      await waitForSeek(video, targetTime, timeoutMs);
      context.drawImage(video, 0, 0, width, height);
      frames.push(frameLuminance(context.getImageData(0, 0, width, height)));
      sampleTimes.push(Number(targetTime.toFixed(3)));
    }
  } catch (error) {
    if (error?.name === "SecurityError") {
      throw new Error("Video pixels are not readable by canvas (CORS restriction); motion analysis was skipped.");
    }
    throw error;
  } finally {
    try { await waitForSeek(video, Math.min(originalTime, Math.max(0, video.duration - 0.01)), timeoutMs); } catch {}
    if (!wasPaused) {
      const playback = video.play?.();
      if (playback && typeof playback.catch === "function") playback.catch(() => {});
    }
  }
  let totalChange = 0, changedPixels = 0, comparisons = 0;
  const regionFrames = [];
  const pixelCount = width * height;
  for (let frame = 1; frame < frames.length; frame += 1) {
    regionFrames.push(extractMotionRegions(frames[frame - 1], frames[frame], width, height, pixelDeltaThreshold, frame));
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const delta = Math.abs(frames[frame][pixel] - frames[frame - 1][pixel]);
      totalChange += delta;
      if (delta >= pixelDeltaThreshold) changedPixels += 1;
      comparisons += 1;
    }
  }
  const meanPixelChange = comparisons ? totalChange / comparisons : 0;
  const changedPixelRatio = comparisons ? changedPixels / comparisons : 0;
  const isLikelyStatic = meanPixelChange < staticMotionThreshold && changedPixelRatio < changedPixelThreshold;
  const motionTracks = linkMotionRegions(regionFrames);
  return {
    status: isLikelyStatic ? "likely-static" : "visible-change",
    sampleCount: frames.length,
    meanPixelChange: Number(meanPixelChange.toFixed(5)),
    changedPixelRatio: Number(changedPixelRatio.toFixed(4)),
    motionRegionObservations: regionFrames.reduce((sum, regions) => sum + regions.length, 0),
    motionTrackCount: motionTracks.length,
    persistentMotionTrackCount: motionTracks.filter(track => track.persistence > 1).length,
    motionTracks,
    sampleTimes,
    perceptionLimitations: 'Tracks anonymous pixel-change regions only. They are not identified as characters or objects and may be caused by camera motion, lighting, particles, cuts or background animation.',
    message: isLikelyStatic ? "Very little pixel change was detected between sampled frames." : "Pixel changes were detected between sampled frames."
  };
}

/**
 * Capture a small, browser-local contact sheet source from a decoded scene clip.
 * Returned data URLs are ephemeral UI evidence; this function does not upload or persist frames.
 */
export async function captureSceneVideoFrameSamples(video, {
  sampleCount = 3, width = 160, height = 90, timeoutMs = 5000,
  canvasFactory = () => document.createElement("canvas")
} = {}) {
  if (!video || typeof video.addEventListener !== "function" || typeof video.removeEventListener !== "function") {
    throw new TypeError("video must be an HTMLVideoElement-like event target.");
  }
  if (!Number.isInteger(sampleCount) || sampleCount < 1 || sampleCount > 5) {
    throw new RangeError("sampleCount must be an integer from 1 to 5.");
  }
  if (![width, height].every(value => Number.isInteger(value) && value > 0 && value <= 512)) {
    throw new RangeError("Frame capture dimensions must be integers from 1 to 512.");
  }
  if (!Number.isFinite(Number(video.duration)) || video.duration <= 0 ||
      !Number.isFinite(Number(video.videoWidth)) || video.videoWidth <= 0 || video.readyState < 2) {
    throw new Error("Scene video must have a decoded frame and a finite duration.");
  }
  if (typeof canvasFactory !== "function") throw new TypeError("canvasFactory must be a function.");
  const canvas = canvasFactory();
  const context = canvas?.getContext?.("2d");
  if (!canvas || !context || typeof context.drawImage !== "function" || typeof canvas.toDataURL !== "function") {
    throw new Error("A readable canvas with data URL support is required for local frame capture.");
  }
  canvas.width = width;
  canvas.height = height;
  const wasPaused = Boolean(video.paused);
  const originalTime = Number(video.currentTime) || 0;
  const samples = [];
  video.pause?.();
  try {
    for (let index = 0; index < sampleCount; index += 1) {
      const fraction = sampleCount === 1 ? 0.5 : 0.08 + (0.84 * index) / (sampleCount - 1);
      const time = Math.min(Math.max(0, video.duration - 0.01), video.duration * fraction);
      await waitForSeek(video, time, timeoutMs);
      context.drawImage(video, 0, 0, width, height);
      samples.push({ time: Number(time.toFixed(2)), dataUrl: canvas.toDataURL("image/jpeg", 0.72) });
    }
  } catch (error) {
    if (error?.name === "SecurityError") {
      throw new Error("Video pixels are not readable by canvas (CORS restriction); frame capture was skipped.");
    }
    throw error;
  } finally {
    try { await waitForSeek(video, Math.min(originalTime, Math.max(0, video.duration - 0.01)), timeoutMs); } catch {}
    if (!wasPaused) {
      const playback = video.play?.();
      if (playback && typeof playback.catch === "function") playback.catch(() => {});
    }
  }
  return samples;
}

const MAX_SCENES = 12;
const MIN_SCENE_SECONDS = 0.25;
const MAX_SCENE_SECONDS = 30;

function duration(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(MIN_SCENE_SECONDS, Math.min(MAX_SCENE_SECONDS, parsed));
}

/** Builds a deterministic scene-by-scene export schedule. */
export function buildExportTimeline(scenes, defaultDurationSeconds = 3) {
  const fallback = duration(defaultDurationSeconds, 3);
  const source = Array.isArray(scenes) ? scenes.slice(0, MAX_SCENES) : [];
  let cursor = 0;
  const segments = source.map((scene, sceneIndex) => {
    const durationSeconds = duration(scene?.durationSeconds ?? scene?.duration, fallback);
    const durationMs = Math.round(durationSeconds * 1000);
    const segment = { sceneIndex, durationSeconds, durationMs, startMs: cursor, endMs: cursor + durationMs };
    cursor += durationMs;
    return segment;
  });
  return { segments, totalDurationMs: cursor, totalDurationSeconds: cursor / 1000 };
}

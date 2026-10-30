export const DEFAULT_SCENE_TRANSITION_FRAMES = 12;

/** Return a bounded 0..1 crossfade progress for deterministic preview/export timing. */
export function getSceneTransitionProgress(startFrame, currentFrame, durationFrames = DEFAULT_SCENE_TRANSITION_FRAMES) {
  const start = Number(startFrame);
  const current = Number(currentFrame);
  const duration = Number(durationFrames);
  const safeStart = Number.isFinite(start) ? start : 0;
  const safeCurrent = Number.isFinite(current) ? current : safeStart;
  const safeDuration = Number.isFinite(duration) && duration >= 1 ? duration : DEFAULT_SCENE_TRANSITION_FRAMES;
  return Math.max(0, Math.min(1, (safeCurrent - safeStart) / safeDuration));
}

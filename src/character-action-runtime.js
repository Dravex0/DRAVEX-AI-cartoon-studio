/**
 * Derive character sprite transforms from a scene action timeline.
 * Motion is explicit metadata: this does not infer poses from prose.
 */
const MOTION_LIMITS = {
  x: [0, 1],
  y: [0, 1],
  width: [0.01, 2],
  height: [0.01, 2],
  rotation: [-Math.PI * 2, Math.PI * 2],
  scale: [0.05, 4],
  opacity: [0, 1]
};
const MOTION_KEYS = Object.keys(MOTION_LIMITS);
const MOTION_DEFAULTS = { x: 0.5, y: 0.5, width: 0.25, height: 0.4, rotation: 0, scale: 1, opacity: 1 };
const isRecord = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));

function normalizePose(value) {
  if (!isRecord(value)) return null;
  const pose = {};
  for (const key of MOTION_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) continue;
    const number = value[key];
    const [min, max] = MOTION_LIMITS[key];
    pose[key] = Math.max(min, Math.min(max, number));
  }
  return Object.keys(pose).length ? pose : null;
}

function easeProgress(progress, easing) {
  const p = Math.max(0, Math.min(1, progress));
  if (easing === 'ease-in') return p * p;
  if (easing === 'ease-out') return 1 - (1 - p) * (1 - p);
  if (easing === 'ease-in-out') return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  return p;
}

function interpolatePose(from, to, progress) {
  const result = { ...from };
  for (const key of MOTION_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(to, key)) continue;
    const start = Number.isFinite(from[key]) ? from[key] : to[key];
    result[key] = start + (to[key] - start) * progress;
  }
  return result;
}

/**
 * Returns new layer objects at normalized scene time (0..1).
 * A phase may provide motion: { from: {x,y,...}, to: {x,y,...} }.
 * Final poses persist until another motion phase changes them.
 */
export function applyCharacterActionTimelineToLayers(layers, actionTimeline, sceneProgress) {
  if (!Array.isArray(layers) || !isRecord(actionTimeline)
      || actionTimeline.schemaVersion !== 1 || !Array.isArray(actionTimeline.phases)) {
    return Array.isArray(layers) ? layers.map(layer => ({ ...layer })) : [];
  }
  const numericProgress = sceneProgress;
  if (typeof numericProgress !== 'number' || !Number.isFinite(numericProgress)) {
    return layers.map(layer => ({ ...layer }));
  }
  const progress = Math.max(0, Math.min(1, numericProgress));
  return layers.map(layer => {
    if (!isRecord(layer) || !String(layer.characterId ?? '').trim()) return layer && typeof layer === 'object' ? { ...layer } : layer;
    const actorId = String(layer.characterId).trim().toLocaleLowerCase();
    const pose = {};
    for (const key of MOTION_KEYS) {
      const value = Number(layer[key]);
      pose[key] = Number.isFinite(value) ? value : MOTION_DEFAULTS[key];
    }
    let changed = false;
    for (const phase of actionTimeline.phases) {
      if (!isRecord(phase) || String(phase.actorId ?? '').trim().toLocaleLowerCase() !== actorId) continue;
      const start = phase.start;
      const end = phase.end;
      if (typeof start !== 'number' || typeof end !== 'number'
          || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > 1 || start >= end) continue;
      const motion = phase.motion;
      if (!isRecord(motion)) continue;
      const from = normalizePose(motion.from);
      const to = normalizePose(motion.to);
      if (!to || progress < start) continue;
      const startPose = { ...pose, ...(from || {}) };
      if (progress < end) {
        const localProgress = (progress - start) / (end - start);
        const easedProgress = easeProgress(localProgress, phase.easing);
        Object.assign(pose, interpolatePose(startPose, to, easedProgress));
        changed = true;
        break;
      }
      Object.assign(pose, startPose, to);
      changed = true;
    }
    return changed ? { ...layer, ...pose } : { ...layer };
  });
}

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
const isRecord = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));

function normalizePose(value) {
  if (!isRecord(value)) return null;
  const pose = {};
  for (const key of MOTION_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const number = Number(value[key]);
    if (!Number.isFinite(number)) continue;
    const [min, max] = MOTION_LIMITS[key];
    pose[key] = Math.max(min, Math.min(max, number));
  }
  return Object.keys(pose).length ? pose : null;
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
  const numericProgress = Number(sceneProgress);
  if (!Number.isFinite(numericProgress)) {
    return layers.map(layer => ({ ...layer }));
  }
  const progress = Math.max(0, Math.min(1, numericProgress));
  return layers.map(layer => {
    if (!isRecord(layer) || !String(layer.characterId ?? '').trim()) return layer && typeof layer === 'object' ? { ...layer } : layer;
    const actorId = String(layer.characterId).trim().toLocaleLowerCase();
    const pose = {};
    for (const key of MOTION_KEYS) {
      const value = Number(layer[key]);
      if (Number.isFinite(value)) pose[key] = value;
    }
    let changed = false;
    for (const phase of actionTimeline.phases) {
      if (!isRecord(phase) || String(phase.actorId ?? '').trim().toLocaleLowerCase() !== actorId) continue;
      const start = Number(phase.start);
      const end = Number(phase.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > 1 || start >= end) continue;
      const motion = phase.motion;
      if (!isRecord(motion)) continue;
      const from = normalizePose(motion.from);
      const to = normalizePose(motion.to);
      if (!to || progress < start) continue;
      const startPose = { ...pose, ...(from || {}) };
      if (progress < end) {
        const localProgress = (progress - start) / (end - start);
        Object.assign(pose, interpolatePose(startPose, to, localProgress));
        changed = true;
        break;
      }
      Object.assign(pose, startPose, to);
      changed = true;
    }
    return changed ? { ...layer, ...pose } : { ...layer };
  });
}

const MAX_KEYFRAMES = 60;
const MAX_CHARACTERS = 20;
const MAX_BONES = 24;
const EASING = new Set(['linear', 'ease-in', 'ease-out', 'ease-in-out']);
const isRecord = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const clean = (value, max = 120) => String(value ?? '').trim().slice(0, max);
const clamp = (value, min, max, fallback = 0) =>
  Math.max(min, Math.min(max, typeof value === 'number' && Number.isFinite(value) ? value : fallback));

function normalizePoseMap(input = {}) {
  if (!isRecord(input)) return {};
  const characters = {};
  for (const [rawCharacterId, rawBones] of Object.entries(input).slice(0, MAX_CHARACTERS)) {
    const characterId = clean(rawCharacterId);
    if (!characterId || !isRecord(rawBones)) continue;
    const bones = {};
    for (const [rawBoneId, rawPose] of Object.entries(rawBones).slice(0, MAX_BONES)) {
      const boneId = clean(rawBoneId);
      if (!boneId || !isRecord(rawPose)) continue;
      const pose = {};
      for (const key of ['x', 'y', 'rotation']) {
        if (typeof rawPose[key] === 'number' && Number.isFinite(rawPose[key])) {
          pose[key] = clamp(rawPose[key], key === 'rotation' ? -Math.PI * 2 : -2, key === 'rotation' ? Math.PI * 2 : 2);
        }
      }
      if (Object.keys(pose).length) bones[boneId] = pose;
    }
    if (Object.keys(bones).length) characters[characterId] = bones;
  }
  return characters;
}

/** Sanitize a scene-local, normalized-time bone animation timeline. */
export function normalizeCharacterRigTimeline(input = {}) {
  const source = isRecord(input) ? input : {};
  const keyframes = (Array.isArray(source.keyframes) ? source.keyframes : []).slice(0, MAX_KEYFRAMES).map(frame => {
    const item = isRecord(frame) ? frame : {};
    return {
      time: clamp(item.time, 0, 1),
      easing: EASING.has(item.easing) ? item.easing : 'linear',
      poses: normalizePoseMap(item.poses)
    };
  });
  return { schemaVersion: source.schemaVersion, keyframes };
}

/** Require at least start/end frames at 0/1 with strictly increasing times. */
export function validateCharacterRigTimeline(input = {}) {
  const timeline = normalizeCharacterRigTimeline(input);
  const issues = [];
  if (timeline.schemaVersion !== 1) issues.push({ code: 'rig-timeline-schema-invalid', message: 'Timeline schemaVersion must be 1.' });
  if (timeline.keyframes.length < 2) issues.push({ code: 'rig-timeline-keyframes-missing', message: 'A rig animation needs at least two keyframes.' });
  if (timeline.keyframes.length > MAX_KEYFRAMES) issues.push({ code: 'rig-timeline-keyframes-limit', message: 'A rig animation cannot exceed 60 keyframes.' });
  if (timeline.keyframes.length && timeline.keyframes[0].time !== 0) {
    issues.push({ code: 'rig-timeline-start-missing', message: 'The first keyframe must start at time 0.' });
  }
  if (timeline.keyframes.length && timeline.keyframes[timeline.keyframes.length - 1].time !== 1) {
    issues.push({ code: 'rig-timeline-end-missing', message: 'The final keyframe must end at time 1.' });
  }
  for (let index = 1; index < timeline.keyframes.length; index++) {
    if (timeline.keyframes[index].time <= timeline.keyframes[index - 1].time) {
      issues.push({ code: 'rig-timeline-order-invalid', message: 'Keyframe times must be strictly increasing.' });
      break;
    }
  }
  return { status: issues.length ? 'invalid' : 'valid', passed: issues.length === 0, timeline, issues };
}

function ease(progress, profile) {
  if (profile === 'ease-in') return progress * progress;
  if (profile === 'ease-out') return 1 - (1 - progress) * (1 - progress);
  if (profile === 'ease-in-out') return progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
  return progress;
}

/** Sample per-character/per-bone transforms at normalized scene progress (0..1). */
export function sampleCharacterRigTimeline(input, progress) {
  const report = validateCharacterRigTimeline(input);
  if (!report.passed) return {};
  const frames = report.timeline.keyframes;
  const time = clamp(progress, 0, 1);
  let left = frames[0], right = frames[frames.length - 1];
  for (let index = 1; index < frames.length; index++) {
    if (time <= frames[index].time) {
      left = frames[index - 1];
      right = frames[index];
      break;
    }
  }
  if (time <= frames[0].time) return normalizePoseMap(frames[0].poses);
  if (time >= frames[frames.length - 1].time) return normalizePoseMap(frames[frames.length - 1].poses);
  const rawProgress = (time - left.time) / (right.time - left.time);
  const amount = ease(rawProgress, right.easing);
  const result = {};
  const characterIds = new Set([...Object.keys(left.poses), ...Object.keys(right.poses)]);
  for (const characterId of characterIds) {
    const leftBones = left.poses[characterId] || {};
    const rightBones = right.poses[characterId] || {};
    const boneIds = new Set([...Object.keys(leftBones), ...Object.keys(rightBones)]);
    const bones = {};
    for (const boneId of boneIds) {
      const from = leftBones[boneId] || {};
      const to = rightBones[boneId] || {};
      const pose = {};
      for (const key of ['x', 'y', 'rotation']) {
        const a = typeof from[key] === 'number' ? from[key] : 0;
        const b = typeof to[key] === 'number' ? to[key] : 0;
        const value = a + (b - a) * amount;
        if (value !== 0) pose[key] = value;
      }
      if (Object.keys(pose).length) bones[boneId] = pose;
    }
    if (Object.keys(bones).length) result[characterId] = bones;
  }
  return result;
}

export const CHARACTER_RIG_TIMELINE_LIMITS = Object.freeze({
  keyframes: MAX_KEYFRAMES, characters: MAX_CHARACTERS, bonesPerCharacter: MAX_BONES
});

import { validateCharacterActionTimeline } from './character-action-timeline.js';
import { detectSceneAction, inferSceneActionIntent } from './scene-action.js';
import { createCharacterRigMotionPreset } from './character-rig-motion-presets.js';
import { sampleCharacterRigTimeline, validateCharacterRigTimeline } from './character-rig-timeline.js';

const clean = value => String(value ?? '').trim();
const key = value => clean(value).toLocaleLowerCase();
const PRESET_BY_ACTION = Object.freeze({ walk: 'walk', run: 'run', jump: 'jump', wave: 'wave' });

function presetForDescription(description) {
  const intent = inferSceneActionIntent(description);
  if (intent.intent === 'dodge') return 'dodge';
  const action = detectSceneAction(description);
  return PRESET_BY_ACTION[action] || null;
}

/**
 * Converts grounded scene action phases into scene-time rig poses.
 * This is deterministic preset mapping, not semantic video understanding.
 * Unsupported/ambiguous actions are skipped rather than guessed.
 */
export function createCharacterRigTimelineFromActionTimeline(scene = {}, rigs = []) {
  if (!Array.isArray(rigs) || !rigs.length) {
    return { status: 'blocked', reason: 'No segmented character rigs are attached to this scene.', timeline: null, generatedCount: 0, skipped: [] };
  }
  const actionReport = validateCharacterActionTimeline(scene);
  if (!actionReport.passed) {
    return { status: 'blocked', reason: 'The scene action timeline must pass story, cast, timing, and evidence checks first.', timeline: null, generatedCount: 0, skipped: actionReport.issues.map(item => item.code) };
  }

  const rigById = new Map(rigs.filter(rig => rig && typeof rig === 'object')
    .map(rig => [key(rig.characterId), rig]));
  const segments = [];
  const skipped = [];
  for (const phase of scene.actionTimeline.phases) {
    const actorId = clean(phase.actorId);
    const preset = presetForDescription(phase.description);
    if (!preset) {
      skipped.push({ actorId, phase: phase.phase, reason: 'unsupported-or-ambiguous-action' });
      continue;
    }
    const rig = rigById.get(key(actorId));
    if (!rig) {
      skipped.push({ actorId, phase: phase.phase, reason: 'actor-rig-missing' });
      continue;
    }
    const result = createCharacterRigMotionPreset(rig, preset);
    if (result.status !== 'ready') {
      skipped.push({ actorId, phase: phase.phase, reason: 'invalid-rig-or-preset', issues: result.issues || [] });
      continue;
    }
    segments.push({ actorId: rig.characterId, start: phase.start, end: phase.end, preset, timeline: result.timeline });
  }

  const byActor = new Map();
  for (const segment of segments) {
    const actorKey = key(segment.actorId);
    const list = byActor.get(actorKey) || [];
    if (list.some(item => segment.start < item.end && segment.end > item.start)) {
      skipped.push({ actorId: segment.actorId, preset: segment.preset, reason: 'overlapping-actor-actions' });
      continue;
    }
    list.push(segment);
    list.sort((a, b) => a.start - b.start);
    byActor.set(actorKey, list);
  }
  const accepted = [...byActor.values()].flat();
  if (!accepted.length) {
    return { status: 'no-supported-actions', reason: 'No supported grounded action could be mapped to an attached character rig.', timeline: null, generatedCount: 0, skipped };
  }

  const times = new Set([0, 1]);
  for (const segment of accepted) {
    for (const frame of segment.timeline.keyframes) {
      times.add(Number((segment.start + (segment.end - segment.start) * frame.time).toFixed(6)));
    }
  }
  const orderedTimes = [...times].sort((a, b) => a - b);
  if (orderedTimes.length > 60) {
    return { status: 'blocked', reason: 'The generated rig timeline would exceed the 60-keyframe safety limit.', timeline: null, generatedCount: 0, skipped };
  }

  const keyframes = orderedTimes.map(time => {
    const poses = {};
    for (const [actorKey, actorSegments] of byActor) {
      const segment = actorSegments.find(item => time >= item.start && time <= item.end);
      if (!segment) continue;
      const localTime = (time - segment.start) / (segment.end - segment.start);
      const sampled = sampleCharacterRigTimeline(segment.timeline, localTime);
      const actorId = segment.actorId;
      if (sampled[actorId]) poses[actorId] = sampled[actorId];
      else {
        const matchingId = Object.keys(sampled).find(id => key(id) === actorKey);
        if (matchingId) poses[actorId] = sampled[matchingId];
      }
    }
    return { time, easing: 'linear', poses };
  });
  const report = validateCharacterRigTimeline({ schemaVersion: 1, keyframes });
  if (!report.passed) {
    return { status: 'invalid-timeline', reason: 'Generated rig timeline did not pass validation.', timeline: null, generatedCount: 0, skipped, issues: report.issues };
  }
  return {
    status: 'generated',
    timeline: report.timeline,
    generatedCount: accepted.length,
    skipped,
    mappedActions: accepted.map(({ actorId, preset, start, end }) => ({ actorId, preset, start, end }))
  };
}

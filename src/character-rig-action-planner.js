import { validateCharacterActionTimeline } from './character-action-timeline.js';
import { detectSceneAction, inferSceneActionIntent } from './scene-action.js';
import { createCharacterRigMotionPreset } from './character-rig-motion-presets.js';
import { sampleCharacterRigTimeline, validateCharacterRigTimeline } from './character-rig-timeline.js';
import { compileDoodleSceneMotion } from './doodle-rig-adapter.js';
import { solveCharacterRigLimbPose } from './character-rig-ik.js';
import { buildScenePhysicsModel } from './scene-physics-model.js';

const clean = value => String(value ?? '').trim();
const key = value => clean(value).toLocaleLowerCase();
const PRESET_BY_ACTION = Object.freeze({ walk: 'walk', run: 'run', jump: 'jump', wave: 'wave', dance: 'dance' });
const PRESET_BY_INTENT = Object.freeze({
  hear_sound: 'listen', listen_carefully: 'listen',
  draw_weapon: 'draw_weapon', aim_weapon: 'aim_weapon',
  hands_up: 'hands_up', take_cover: 'take_cover',
  drop_weapon: 'drop_weapon', freeze: 'freeze', discover_threat: 'freeze',
  pick_up: 'pick_up', grasp: 'grasp', release: 'release', carry: 'carry',
  throw: 'throw', catch: 'catch', push: 'push', pull: 'pull',
  hug: 'hug', point: 'point', sit: 'sit'
});

function presetForDescription(description) {
  const intent = inferSceneActionIntent(description);
  if (intent.intent === 'dodge') return 'dodge';
  if (intent.intent === 'attack') return 'attack';
  if (intent.intent === 'defend') return 'defend';
  const action = detectSceneAction(description);
  return PRESET_BY_ACTION[action] || null;
}

function doodleActionForDescription(description) {
  const text = clean(description).normalize('NFKC').toLocaleLowerCase();
  const intent = inferSceneActionIntent(text);
  if (intent.motionCue === 'talk' || detectSceneAction(text) === 'talk') return 'talk';
  const action = detectSceneAction(text);
  if (action === 'sad' && /scared|afraid|fearful|terrified|боится|испуган|страшится|зляка|налякан|asustad|temeros|tiene miedo/i.test(text)) {
    return 'scared';
  }
  return null;
}


const normalizedBoneId = value => String(value ?? '').toLocaleLowerCase().replace(/[^a-z0-9]/g, '');

function resolvePropTargetPosition(scene, phase) {
  const targetKey = key(phase?.targetId);
  if (!targetKey) return null;
  const matches = (Array.isArray(scene?.stateChanges) ? scene.stateChanges : [])
    .filter(change => change?.entityType === 'prop' && key(change.entityId) === targetKey
      && Number.isFinite(change.position?.x) && change.position.x >= 0 && change.position.x <= 1
      && Number.isFinite(change.position?.y) && change.position.y >= 0 && change.position.y <= 1);
  const intentMatches = matches.filter(change => key(change.actionIntent) === key(phase.intent));
  const candidates = intentMatches.length ? intentMatches : matches;
  return candidates.length === 1
    ? { x: candidates[0].position.x, y: candidates[0].position.y }
    : null;
}

const PHYSICS_TARGET_TYPES_BY_INTENT = Object.freeze({
  pick_up: ['grasp'], grasp: ['grasp'], catch: ['catch'],
  carry: ['carry'], throw: ['throw'], release: ['release'],
  push: ['push'], pull: ['pull']
});

function normalizedViewportPoint(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Number.isFinite(value.x) && value.x >= 0 && value.x <= 1
    && Number.isFinite(value.y) && value.y >= 0 && value.y <= 1
    ? { x: value.x, y: value.y } : null;
}

/** Resolve a contact point only from one grounded, actor-matched physics event. */
function resolveGroundedPhysicsTargetPosition(scene, phase) {
  const intent = key(phase?.intent);
  const targetId = key(phase?.targetId);
  const actorId = key(phase?.actorId);
  const allowedTypes = PHYSICS_TARGET_TYPES_BY_INTENT[intent] || [];
  if (!targetId || !actorId || !allowedTypes.length) return null;

  const physicsModel = buildScenePhysicsModel([scene]);
  const candidates = physicsModel.events.filter(event =>
    event.grounded === true
    && key(event.entityId) === targetId
    && key(event.actorId) === actorId
    && allowedTypes.includes(key(event.type))
  );
  const evidenceMatches = candidates.filter(event => key(event.evidence) === key(phase.evidence));
  const selected = evidenceMatches.length ? evidenceMatches : candidates;
  if (selected.length !== 1) return null;

  const source = (Array.isArray(scene?.physicsEvents) ? scene.physicsEvents : [])
    .find(event => key(event?.id) === key(selected[0].id));
  if (!source) return null;
  // A catch meets the incoming object at the end of its authored path.
  // Grasp/pick-up/push/pull/throw/release begin at the object's authored start.
  const rawPoint = intent === 'catch' ? source.visualEndPosition : source.visualStartPosition;
  return normalizedViewportPoint(rawPoint);
}

function solveTargetedArmPose(rig, target) {
  const bones = Array.isArray(rig?.bones) ? rig.bones : [];
  const upperBones = bones.filter(bone => {
    const id = normalizedBoneId(bone.id);
    return /arm|shoulder/.test(id) && !/forearm|lowerarm/.test(id);
  });
  const lowerBones = bones.filter(bone => /forearm|lowerarm/.test(normalizedBoneId(bone.id)));
  const endBones = bones.filter(bone => /hand|wrist|paw/.test(normalizedBoneId(bone.id)));
  const candidates = [];
  for (const upper of upperBones) {
    for (const lower of lowerBones.filter(item => item.parentId?.toLowerCase() === upper.id.toLowerCase())) {
      for (const end of endBones.filter(item => item.parentId?.toLowerCase() === lower.id.toLowerCase())) {
        const solved = solveCharacterRigLimbPose(rig, {
          upperBoneId: upper.id, lowerBoneId: lower.id, endBoneId: end.id, target
        });
        if (solved.status === 'solved' && solved.reachable === true) {
          candidates.push({
            solved,
            restDistance: Math.hypot(end.pivotX - target.x, end.pivotY - target.y)
          });
        }
      }
    }
  }
  candidates.sort((a, b) => a.restDistance - b.restDistance);
  if (!candidates.length) return { status: 'unavailable' };
  if (candidates.length > 1 && Math.abs(candidates[0].restDistance - candidates[1].restDistance) < 1e-6) {
    return { status: 'ambiguous' };
  }
  return { status: 'solved', pose: candidates[0].solved.pose };
}

function applyTargetedArmPose(timeline, actorId, targetPose) {
  const frames = timeline.keyframes || [];
  const firstPose = frames.find(frame => frame.poses?.[actorId])?.poses?.[actorId] || {};
  const boneIds = Object.keys(targetPose);
  return {
    ...timeline,
    keyframes: frames.map(frame => {
      const currentActorPose = frame.poses?.[actorId];
      if (!currentActorPose) return frame;
      const pose = { ...currentActorPose };
      const eased = frame.time * frame.time * (3 - 2 * frame.time);
      for (const boneId of boneIds) {
        const startRotation = Number.isFinite(firstPose[boneId]?.rotation) ? firstPose[boneId].rotation : 0;
        const targetRotation = targetPose[boneId].rotation;
        pose[boneId] = {
          ...(pose[boneId] || {}),
          rotation: startRotation + (targetRotation - startRotation) * eased
        };
      }
      return { ...frame, poses: { ...frame.poses, [actorId]: pose } };
    })
  };
}

function blendCharacterPose(from = {}, to = {}, progress = 0) {
  const result = {};
  const boneIds = new Set([...Object.keys(from), ...Object.keys(to)]);
  for (const boneId of boneIds) {
    const fromBone = from[boneId] || {};
    const toBone = to[boneId] || {};
    const pose = {};
    for (const property of ['x', 'y', 'rotation']) {
      const start = Number.isFinite(fromBone[property]) ? fromBone[property] : 0;
      const end = Number.isFinite(toBone[property]) ? toBone[property] : 0;
      const value = start + (end - start) * progress;
      if (value !== 0) pose[property] = value;
    }
    if (Object.keys(pose).length) result[boneId] = pose;
  }
  return result;
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
  const actionSteps = scene.actionTimeline.phases.flatMap(phase =>
    Array.isArray(phase.steps) ? phase.steps.map(step => ({ ...step, phase: phase.phase })) : [phase]
  );
  for (const phase of actionSteps) {
    const actorId = clean(phase.actorId);
    const cuePreset = PRESET_BY_INTENT[phase.intent] || PRESET_BY_ACTION[phase.motionCue] || null;
    const preset = cuePreset || presetForDescription(phase.description);
    const doodleAction = preset ? null : doodleActionForDescription(phase.description);
    if (!preset && !doodleAction) {
      skipped.push({ actorId, phase: phase.phase, reason: 'unsupported-or-ambiguous-action' });
      continue;
    }
    const rig = rigById.get(key(actorId));
    if (!rig) {
      skipped.push({ actorId, phase: phase.phase, reason: 'actor-rig-missing' });
      continue;
    }
    const result = preset
      ? createCharacterRigMotionPreset(rig, preset)
      : compileDoodleSceneMotion({ characters: [actorId], action: doodleAction }, [rig]);
    if (result.status !== 'ready' || !result.timeline) {
      skipped.push({ actorId, phase: phase.phase, reason: 'invalid-rig-or-preset', issues: result.issues || [] });
      continue;
    }
    let timeline = result.timeline;
    let targetedReach = null;
    const resolvedPropPosition = phase.targetPosition ? null : resolvePropTargetPosition(scene, phase);
    const resolvedPhysicsPosition = phase.targetPosition || resolvedPropPosition
      ? null : resolveGroundedPhysicsTargetPosition(scene, phase);
    const targetPosition = phase.targetPosition || resolvedPropPosition || resolvedPhysicsPosition;
    const targetPositionSource = phase.targetPosition ? 'action-timeline'
      : resolvedPropPosition ? 'prop-state-change'
      : resolvedPhysicsPosition ? 'grounded-physics-event' : null;
    if (targetPosition) {
      const armSolution = solveTargetedArmPose(rig, targetPosition);
      targetedReach = armSolution.status;
      if (armSolution.status === 'solved') {
        timeline = applyTargetedArmPose(timeline, rig.characterId, armSolution.pose);
      } else {
        skipped.push({
          actorId, phase: phase.phase,
          reason: armSolution.status === 'ambiguous' ? 'targeted-arm-chain-ambiguous' : 'targeted-arm-ik-unavailable'
        });
      }
    }
    segments.push({
      actorId: rig.characterId,
      start: phase.start,
      end: phase.end,
      preset: preset || result.actions?.[0]?.preset || 'idle',
      doodleAction,
      ...(targetedReach ? { targetedReach, targetPositionSource } : {}),
      timeline
    });
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
  // Preserve the prior pose through gaps, then blend into the next action
  // over a short anticipation window instead of snapping at its first frame.
  for (const actorSegments of byActor.values()) {
    for (let index = 1; index < actorSegments.length; index++) {
      const previous = actorSegments[index - 1];
      const next = actorSegments[index];
      const gap = next.start - previous.end;
      if (gap > 0.00001) {
        const holdTime = Number((next.start - Math.min(0.001, gap / 2)).toFixed(6));
        if (holdTime > previous.end && holdTime < next.start) times.add(holdTime);
      }
      const transitionDuration = Math.min((next.end - next.start) * 0.12, 0.08);
      if (transitionDuration > 0.00001) {
        times.add(Number((next.start + transitionDuration).toFixed(6)));
      }
    }
  }
  const orderedTimes = [...times].sort((a, b) => a - b);
  if (orderedTimes.length > 60) {
    return { status: 'blocked', reason: 'The generated rig timeline would exceed the 60-keyframe safety limit.', timeline: null, generatedCount: 0, skipped };
  }

  const keyframes = orderedTimes.map(time => {
    const poses = {};
    for (const [actorKey, actorSegments] of byActor) {
      const activeIndex = actorSegments.findIndex(item => time >= item.start && time <= item.end);
      const activeSegment = activeIndex >= 0 ? actorSegments[activeIndex] : null;
      const previousSegment = activeIndex > 0
        ? actorSegments[activeIndex - 1]
        : [...actorSegments].reverse().find(item => item.end < time);
      const nextSegment = actorSegments.find(item => item.start > time);

      if (activeSegment && activeIndex > 0) {
        const transitionDuration = Math.min((activeSegment.end - activeSegment.start) * 0.12, 0.08);
        const transitionEnd = activeSegment.start + transitionDuration;
        if (transitionDuration > 0.00001 && time >= activeSegment.start && time < transitionEnd) {
          const previousSample = sampleCharacterRigTimeline(previousSegment.timeline, 1);
          const nextLocalTime = (time - activeSegment.start) / (activeSegment.end - activeSegment.start);
          const nextSample = sampleCharacterRigTimeline(activeSegment.timeline, nextLocalTime);
          const previousPose = previousSample[previousSegment.actorId] || {};
          const nextPose = nextSample[activeSegment.actorId] || {};
          const rawProgress = (time - activeSegment.start) / transitionDuration;
          const easedProgress = rawProgress * rawProgress * (3 - 2 * rawProgress);
          poses[activeSegment.actorId] = blendCharacterPose(previousPose, nextPose, easedProgress);
          continue;
        }
      }

      // Keep the last authored pose through idle gaps instead of snapping the
      // character back to the rig rest pose when no action segment is active.
      // Before the first action, sample its initial (normally neutral) pose.
      const segment = activeSegment || previousSegment || nextSegment;
      if (!segment) continue;
      const localTime = activeSegment
        ? (time - segment.start) / (segment.end - segment.start)
        : previousSegment ? 1 : 0;
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
    mappedActions: accepted.map(({ actorId, preset, doodleAction, targetedReach, targetPositionSource, phase, start, end }) => ({
      actorId, preset, phase, start, end,
      ...(doodleAction ? { doodleAction } : {}),
      ...(targetedReach ? { targetedReach, targetPositionSource } : {})
    }))
  };
}

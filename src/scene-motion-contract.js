import { inferSceneActionIntent } from './scene-action.js';
import { validateCharacterActionTimeline } from './character-action-timeline.js';
import { validateCharacterRigTimeline } from './character-rig-timeline.js';

const ACTION_REQUIREMENTS = Object.freeze({
  walk: ['legs'],
  run: ['legs'],
  jump: ['core', 'legs'],
  attack: ['arms'],
  defend: ['arms', 'core'],
  dodge: ['core', 'legs'],
  wave: ['arms'],
  dance: ['arms', 'legs'],
  turn: ['core', 'head'],
  float: ['core'],
  vanish: ['core'],
  magic: ['arms', 'core'],
  team_magic: ['arms', 'core'],
  energy_clash: ['arms', 'core'],
  power_up: ['core'],
  reveal: ['core'],
  warning: ['head', 'arms']
});

const isRecord = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const clean = value => String(value ?? '').trim();
const normalizeId = value => clean(value).toLocaleLowerCase();

function actionFromScene(scene) {
  const candidates = [
    ['motionPrompt', scene?.motionPrompt],
    ['visibleAction', scene?.visibleAction],
    ['storyDetail', scene?.storyDetail],
    ['description', scene?.description],
    ['prompt', scene?.prompt],
    ['title', scene?.title]
  ];
  for (const [sourceField, value] of candidates) {
    const evidence = clean(value);
    if (!evidence) continue;
    const result = inferSceneActionIntent(evidence);
    if (result.intent !== 'unknown' && result.intent !== 'descriptive' && result.motionCue !== 'idle') {
      return { ...result, sourceField };
    }
  }
  return { intent: 'unknown', motionCue: 'idle', confidence: 0, evidence: '', sourceField: null };
}

function boneGroup(boneId) {
  const id = clean(boneId).toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
  if (/root|hips|pelvis|torso|body|spine/.test(id)) return 'core';
  if (/head|neck/.test(id)) return 'head';
  if (/left|right|upper|lower|fore|arm|hand|shoulder/.test(id) && /arm|hand|shoulder/.test(id)) return 'arms';
  if (/left|right|upper|lower|thigh|knee|leg|foot|ankle|toe/.test(id) && /thigh|knee|leg|foot|ankle|toe/.test(id)) return 'legs';
  if (/face|eye|mouth|jaw|brow/.test(id)) return 'face';
  if (/weapon|sword|blade|staff/.test(id)) return 'weapon';
  return null;
}

function changedRigBones(timeline, characterId) {
  const frames = timeline.keyframes;
  const changed = new Set();
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1].poses[characterId] || {};
    const current = frames[index].poses[characterId] || {};
    const boneIds = new Set([...Object.keys(previous), ...Object.keys(current)]);
    for (const boneId of boneIds) {
      const before = previous[boneId] || {};
      const after = current[boneId] || {};
      if (['x', 'y', 'rotation'].some(key => Math.abs((after[key] || 0) - (before[key] || 0)) > 0.0001)) {
        changed.add(boneId);
      }
    }
  }
  return [...changed];
}

function hasSpriteTransform(timeline) {
  if (!isRecord(timeline) || !Array.isArray(timeline.phases)) return false;
  return timeline.phases.some(phase => {
    const motion = phase?.motion;
    const from = motion?.from || {};
    const to = motion?.to || {};
    const keys = ['x', 'y', 'width', 'height', 'rotation', 'scale', 'opacity']
      .filter(key => typeof to[key] === 'number');
    if (!keys.length) return false;
    if (!isRecord(motion.from)) return true;
    return keys.some(key => Math.abs(to[key] - (typeof from[key] === 'number' ? from[key] : to[key])) > 0.0001);
  });
}

/**
 * Compare a scene's declared story action with explicit character animation metadata.
 * This is a metadata contract check, not visual recognition and not proof that a rendered
 * video follows the animation data.
 */
export function auditSceneMotionContract(scene = {}) {
  scene = isRecord(scene) ? scene : {};
  const action = actionFromScene(scene);
  const requirements = ACTION_REQUIREMENTS[action.intent] || [];
  const actionTimeline = validateCharacterActionTimeline(scene);
  const spriteMotionDefined = hasSpriteTransform(scene.characterMotionTimeline)
    || hasSpriteTransform(scene.actionTimeline);
  const rawRigTimeline = scene.characterRigTimeline;
  const rigTimeline = rawRigTimeline == null
    ? { passed: null, status: 'not-provided', timeline: null, issues: [] }
    : validateCharacterRigTimeline(rawRigTimeline);

  const cast = (Array.isArray(scene.characters) ? scene.characters : [])
    .map(normalizeId).filter(Boolean);
  const rigs = (Array.isArray(scene.characterRigs) ? scene.characterRigs : [])
    .filter(isRecord)
    .filter(rig => !cast.length || cast.includes(normalizeId(rig.characterId)));

  const animatedBones = [];
  const animatedGroups = new Set();
  const rigCharacterIds = [];
  let hasUnboundTimelineMotion = false;
  if (rigTimeline.passed) {
    const timelineCharacters = new Set(rigTimeline.timeline.keyframes.flatMap(frame => Object.keys(frame.poses)));
    hasUnboundTimelineMotion = [...timelineCharacters].some(characterId =>
      changedRigBones(rigTimeline.timeline, characterId).length > 0
    );
    for (const rig of rigs) {
      const characterId = clean(rig.characterId);
      const timelineCharacterId = [...timelineCharacters].find(id => normalizeId(id) === normalizeId(characterId));
      if (!characterId || !timelineCharacterId) continue;
      const boneIds = new Map((Array.isArray(rig.bones) ? rig.bones : [])
        .map(bone => [normalizeId(bone?.id), clean(bone?.id)]).filter(([key, value]) => key && value));
      const changed = changedRigBones(rigTimeline.timeline, timelineCharacterId)
        .map(id => boneIds.get(normalizeId(id))).filter(Boolean);
      if (!changed.length) continue;
      rigCharacterIds.push(characterId);
      for (const boneId of changed) {
        animatedBones.push({ characterId, boneId, group: boneGroup(boneId) });
        const group = boneGroup(boneId);
        if (group) animatedGroups.add(group);
      }
    }
  }

  const coveredGroups = requirements.filter(group => animatedGroups.has(group));
  const missingGroups = requirements.filter(group => !animatedGroups.has(group));
  let animationStatus = 'no-action-cue';
  if (action.intent !== 'unknown') {
    if (rigTimeline.status === 'invalid') animationStatus = 'invalid-rig-timeline';
    else if (requirements.length && !rigTimeline.passed) {
      animationStatus = spriteMotionDefined ? 'sprite-motion-only' : 'no-rig-motion-data';
    } else if (requirements.length && rigTimeline.passed && !animatedBones.length && hasUnboundTimelineMotion) {
      animationStatus = rigs.length ? 'rig-bone-binding-missing' : 'rig-character-binding-missing';
    } else if (requirements.length && rigTimeline.passed && !animatedBones.length) {
      animationStatus = 'rig-timeline-has-no-changing-bones';
    } else if (requirements.length && missingGroups.length) {
      animationStatus = 'partial-rig-motion-coverage';
    } else if (requirements.length && coveredGroups.length === requirements.length) {
      animationStatus = 'rig-motion-metadata-covers-action';
    } else {
      animationStatus = spriteMotionDefined ? 'sprite-motion-defined' : 'action-described-only';
    }
  }

  return {
    sceneId: clean(scene.id) || null,
    action: {
      intent: action.intent,
      motionCue: action.motionCue,
      confidence: action.confidence,
      sourceField: action.sourceField,
      evidence: action.evidence
    },
    requirements,
    actionTimelineStatus: actionTimeline.status,
    rigTimelineStatus: rigTimeline.status,
    animationStatus,
    spriteMotionDefined,
    animatedCharacterIds: [...new Set(rigCharacterIds)],
    animatedBones,
    animatedGroups: [...animatedGroups].sort(),
    coveredGroups,
    missingGroups,
    limitations: [
      'Checks action wording and animation metadata only; it does not inspect character pixels or recognize actions in the rendered video.',
      'A keyframed bone may still be visually ineffective if its artwork, pivot, or renderer binding is incorrect.',
      'Facial expression and lip-sync quality are not evaluated by this report.'
    ]
  };
}

/** Audit a storyboard without treating missing animation metadata as a passing result. */
export function auditStoryboardMotionContracts(scenes = []) {
  const items = (Array.isArray(scenes) ? scenes : []).map(auditSceneMotionContract);
  const actionable = items.filter(item => item.action.intent !== 'unknown');
  const covered = actionable.filter(item => item.animationStatus === 'rig-motion-metadata-covers-action').length;
  return {
    sceneCount: items.length,
    actionSceneCount: actionable.length,
    rigCoveredSceneCount: covered,
    coverage: actionable.length ? Math.round((covered / actionable.length) * 100) : null,
    items,
    limitations: [
      'Coverage measures explicit rig-keyframe metadata against a coarse action-to-body-group contract.',
      'It is not a visual animation-quality score or proof of real motion in exported video.'
    ]
  };
}

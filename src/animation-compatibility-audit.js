import { validateCharacterRig } from './character-rig.js';
import { validateCharacterFacialRig } from './character-facial-rig.js';
import { validateCharacterRigTimeline } from './character-rig-timeline.js';
import { validateCharacterActionTimeline } from './character-action-timeline.js';

const key = value => String(value ?? '').trim().toLocaleLowerCase();
const record = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));

function addIssue(issues, sceneIndex, code, severity, message, characterId = null) {
  issues.push({ sceneIndex, code, severity, message, characterId });
}

/**
 * Audit cross-module animation compatibility for every storyboard scene.
 * This validates schemas, character/bone references and shared scene-time ranges.
 * It does not inspect pixels or prove that the rendered action looks correct.
 */
export function auditAnimationCompatibility(scenes) {
  const source = Array.isArray(scenes) ? scenes : [];
  const issues = [];
  let rigCount = 0;
  let facialRigCount = 0;
  let rigTimelineCount = 0;
  let actionTimelineCount = 0;
  let spriteMotionTimelineCount = 0;
  let voiceCueCount = 0;

  source.forEach((rawScene, sceneIndex) => {
    const scene = record(rawScene) ? rawScene : {};
    const rigs = Array.isArray(scene.characterRigs) ? scene.characterRigs : [];
    const layers = Array.isArray(scene.characterLayers) ? scene.characterLayers : [];
    const facialRigs = Array.isArray(scene.characterFacialRigs) ? scene.characterFacialRigs : [];
    const rigById = new Map();
    const layerIds = new Set();

    for (const layer of layers) {
      const id = key(layer?.characterId);
      if (!id) {
        addIssue(issues, sceneIndex, 'sprite-character-id-missing', 'error', 'A character sprite layer has no characterId.');
        continue;
      }
      if (layerIds.has(id)) {
        addIssue(issues, sceneIndex, 'sprite-character-duplicate', 'error', 'A scene contains duplicate sprite layers for the same character.', layer.characterId);
      }
      layerIds.add(id);
    }

    for (const input of rigs) {
      const report = validateCharacterRig(input);
      if (!report.passed) {
        for (const item of report.issues) addIssue(issues, sceneIndex, item.code, 'error', item.message, input?.characterId || null);
        continue;
      }
      rigCount++;
      const id = key(report.rig.characterId);
      if (rigById.has(id)) {
        addIssue(issues, sceneIndex, 'rig-character-duplicate', 'error', 'A scene contains more than one body rig for the same character.', report.rig.characterId);
      } else {
        rigById.set(id, report.rig);
      }
    }

    const facialIds = new Set();
    for (const facialInput of facialRigs) {
      const facialId = key(facialInput?.characterId);
      const bodyRig = rigById.get(facialId) || null;
      const facialBodyRig = bodyRig && key(bodyRig.characterId) === facialId
        ? { ...bodyRig, characterId: facialInput.characterId }
        : bodyRig;
      const report = validateCharacterFacialRig(facialInput, facialBodyRig);
      if (!report.passed) {
        for (const item of report.issues) addIssue(issues, sceneIndex, item.code, 'error', item.message, facialInput?.characterId || null);
        continue;
      }
      facialRigCount++;
      if (facialIds.has(facialId)) {
        addIssue(issues, sceneIndex, 'facial-rig-character-duplicate', 'error', 'A scene contains more than one facial rig for the same character.', report.rig.characterId);
      }
      facialIds.add(facialId);
      if (!bodyRig) {
        addIssue(issues, sceneIndex, 'facial-head-follow-unavailable', 'warning', 'The facial rig has no matching body rig; facial layers can render, but head-bone following is unavailable.', report.rig.characterId);
      }
      if (!layerIds.has(facialId) && !bodyRig) {
        addIssue(issues, sceneIndex, 'facial-character-not-renderable', 'error', 'A facial rig has neither a matching sprite layer nor a body rig.', report.rig.characterId);
      }
    }

    const rigTimeline = scene.characterRigTimeline;
    if (rigTimeline != null) {
      rigTimelineCount++;
      const report = validateCharacterRigTimeline(rigTimeline);
      if (!report.passed || (Array.isArray(rigTimeline.keyframes) && rigTimeline.keyframes.length > 60)) {
        for (const item of report.issues) addIssue(issues, sceneIndex, item.code, 'error', item.message);
        if (rigTimeline.keyframes?.length > 60) {
          addIssue(issues, sceneIndex, 'rig-timeline-keyframe-limit', 'error', 'A rig timeline cannot contain more than 60 keyframes.');
        }
      } else {
        for (const frame of report.timeline.keyframes) {
          for (const [rawCharacterId, bones] of Object.entries(frame.poses || {})) {
            const characterId = key(rawCharacterId);
            const rig = rigById.get(characterId);
            if (!rig) {
              addIssue(issues, sceneIndex, 'timeline-character-rig-missing', 'error', 'A rig timeline references a character without an attached body rig.', rawCharacterId);
              continue;
            }
            const allowedBones = new Set(rig.bones.map(bone => key(bone.id)));
            for (const boneId of Object.keys(bones || {})) {
              if (!allowedBones.has(key(boneId))) {
                addIssue(issues, sceneIndex, 'timeline-bone-missing', 'error', 'A rig timeline references a bone that does not exist in this character rig.', rawCharacterId + '.' + boneId);
              }
            }
          }
        }
      }
    }

    if (scene.actionTimeline != null) {
      actionTimelineCount++;
      const report = validateCharacterActionTimeline(scene);
      for (const item of report.issues) {
        addIssue(issues, sceneIndex, item.code, 'error', item.message, item.phase || null);
      }
      for (const phase of Array.isArray(scene.actionTimeline.phases) ? scene.actionTimeline.phases : []) {
        const actorId = key(phase?.actorId);
        if (actorId && !rigById.has(actorId) && !layerIds.has(actorId)) {
          addIssue(issues, sceneIndex, 'action-actor-not-renderable', 'error', 'A story action references a character with neither a body rig nor a sprite layer.', phase.actorId);
        }
        if (actorId && phase?.motion && rigById.has(actorId)) {
          addIssue(issues, sceneIndex, 'rig-suppresses-sprite-motion', 'warning', 'This action phase contains sprite transforms, but the ready body rig is rendered instead of the sprite. Use a rig timeline for the character body.', phase.actorId);
        }
      }
    }

    const spriteTimeline = scene.characterMotionTimeline;
    if (spriteTimeline != null) {
      spriteMotionTimelineCount++;
      if (!record(spriteTimeline) || spriteTimeline.schemaVersion !== 1 || !Array.isArray(spriteTimeline.phases)) {
        addIssue(issues, sceneIndex, 'sprite-motion-timeline-invalid', 'error', 'The sprite motion timeline must use schemaVersion 1 and a phases array.');
      } else {
        for (const phase of spriteTimeline.phases) {
          const actorId = key(phase?.actorId);
          if (!actorId || !Number.isFinite(phase?.start) || !Number.isFinite(phase?.end)
            || phase.start < 0 || phase.end > 1 || phase.start >= phase.end
            || !record(phase.motion) || !record(phase.motion.to)) {
            addIssue(issues, sceneIndex, 'sprite-motion-phase-invalid', 'error', 'A sprite motion phase has invalid actor, normalized timing, or target transform.', phase?.actorId || null);
          } else if (!layerIds.has(actorId)) {
            addIssue(issues, sceneIndex, 'sprite-motion-layer-missing', 'error', 'A sprite motion phase references a character without a sprite layer.', phase.actorId);
          } else if (rigById.has(actorId)) {
            addIssue(issues, sceneIndex, 'rig-suppresses-sprite-motion', 'warning', 'This character has a ready body rig: sprite transform motion is not applied to the rig-rendered body. Use a rig timeline for its body movement.', phase.actorId);
          }
        }
      }
    }

    const voiceCues = Array.isArray(scene.voiceCues) ? scene.voiceCues : [];
    voiceCueCount += voiceCues.length;
    const sceneDurationMs = Number(scene.durationSeconds ?? scene.duration) * 1000;
    for (const cue of voiceCues) {
      const speakerId = String(cue?.characterId || cue?.characterName || '').trim();
      const speakerKey = key(speakerId);
      if (!speakerKey || !Number.isInteger(cue?.startFrame) || cue.startFrame < 0
        || !Number.isFinite(cue?.durationMs) || cue.durationMs <= 0) {
        addIssue(issues, sceneIndex, 'voice-cue-timing-invalid', 'error', 'A dialogue cue needs a character ID/name, a non-negative integer startFrame, and a measured positive durationMs.', speakerId || null);
        continue;
      }
      const cueStartMs = cue.startFrame * (1000 / 24);
      const cueEndMs = cueStartMs + cue.durationMs;
      if (Number.isFinite(sceneDurationMs) && sceneDurationMs > 0 && cueEndMs > sceneDurationMs + 2) {
        addIssue(issues, sceneIndex, 'voice-cue-exceeds-scene', 'warning', 'A dialogue cue extends beyond the scene duration and may be cut off by the final export timeline.', speakerId);
      }
      if ((rigById.has(speakerKey) || layerIds.has(speakerKey)) && !facialIds.has(speakerKey)) {
        addIssue(issues, sceneIndex, 'voice-cue-facial-rig-missing', 'warning', 'This visible character has dialogue but no matching facial rig, so generated visemes cannot animate its mouth.', speakerId);
      }
      if (cue.visemeEvents != null) {
        if (!Array.isArray(cue.visemeEvents) || cue.visemeEvents.length > 2000) {
          addIssue(issues, sceneIndex, 'voice-viseme-events-invalid', 'error', 'Dialogue viseme events must be an array with at most 2000 entries.', speakerId);
        } else {
          let previousStart = -1;
          for (const event of cue.visemeEvents) {
            const startMs = Number(event?.startMs);
            const durationMs = Number(event?.durationMs);
            if (!['neutral', 'open', 'wide', 'round', 'closed', 'teeth'].includes(String(event?.shape || ''))
              || !Number.isFinite(startMs) || !Number.isFinite(durationMs) || startMs < 0
              || durationMs <= 0 || startMs < previousStart || startMs >= cue.durationMs + 50
              || startMs + durationMs > cue.durationMs + 50) {
              addIssue(issues, sceneIndex, 'voice-viseme-timing-invalid', 'error', 'A dialogue viseme event has an unsupported mouth shape or timing outside its measured audio cue.', speakerId);
              break;
            }
            previousStart = startMs;
          }
        }
      }
      if (cue.phonemeChunks != null) {
        if (!Array.isArray(cue.phonemeChunks) || cue.phonemeChunks.length > 120) {
          addIssue(issues, sceneIndex, 'voice-phoneme-chunks-invalid', 'error', 'Dialogue phoneme chunks must be an array with at most 120 entries.', speakerId);
        } else {
          let previousEnd = 0;
          for (const chunk of cue.phonemeChunks) {
            const startMs = Number(chunk?.startMs);
            const endMs = Number(chunk?.endMs);
            if (!String(chunk?.phonemes || '').trim() || !Number.isFinite(startMs) || !Number.isFinite(endMs)
              || startMs < previousEnd - 0.5 || endMs <= startMs || endMs > cue.durationMs + 2) {
              addIssue(issues, sceneIndex, 'voice-phoneme-timing-invalid', 'error', 'A dialogue phoneme chunk has invalid or overlapping timing relative to its measured audio cue.', speakerId);
              break;
            }
            previousEnd = endMs;
          }
        }
      }
    }

    const expressions = record(scene.characterFacialExpressions) ? scene.characterFacialExpressions : {};
    for (const characterId of Object.keys(expressions)) {
      if (!facialIds.has(key(characterId))) {
        addIssue(issues, sceneIndex, 'facial-expression-rig-missing', 'warning', 'Facial expression controls have no matching facial rig and will not be visible.', characterId);
      }
    }

    if (scene.characterRigPoses && !rigTimeline) {
      for (const [characterId, bones] of Object.entries(scene.characterRigPoses)) {
        const rig = rigById.get(key(characterId));
        if (!rig) {
          addIssue(issues, sceneIndex, 'static-pose-rig-missing', 'error', 'A static rig pose references a character without an attached body rig.', characterId);
          continue;
        }
        const allowedBones = new Set(rig.bones.map(bone => key(bone.id)));
        for (const boneId of Object.keys(bones || {})) {
          if (!allowedBones.has(key(boneId))) {
            addIssue(issues, sceneIndex, 'static-pose-bone-missing', 'error', 'A static pose references a bone that does not exist in this character rig.', characterId + '.' + boneId);
          }
        }
      }
    }

    const duration = Number(scene.durationSeconds ?? scene.duration);
    if (scene.durationSeconds != null || scene.duration != null) {
      if (!Number.isFinite(duration) || duration < 0.25 || duration > 30) {
        addIssue(issues, sceneIndex, 'scene-duration-out-of-range', 'warning', 'Scene duration is outside the supported 0.25–30 second range; preview/export may fall back to a default.');
      }
    }
  });

  const errors = issues.filter(item => item.severity === 'error').length;
  const warnings = issues.filter(item => item.severity === 'warning').length;
  return {
    schemaVersion: 1,
    sceneCount: source.length,
    rigCount,
    facialRigCount,
    rigTimelineCount,
    actionTimelineCount,
    spriteMotionTimelineCount,
    voiceCueCount,
    errorCount: errors,
    warningCount: warnings,
    status: errors ? 'incompatible' : warnings ? 'compatible-with-warnings' : 'compatible',
    passed: errors === 0,
    issues,
    limitations: [
      'Checks module schemas, character IDs, bone references, and normalized scene-time compatibility.',
      'Does not inspect rendered pixels, asset loading, visual action correctness, voice audibility, or final video playback.'
    ]
  };
}

import { createCharacterRigMotionPreset } from './character-rig-motion-presets.js';
import { sampleCharacterRigTimeline, validateCharacterRigTimeline } from './character-rig-timeline.js';

const ACTION_PRESETS = Object.freeze({
  idle: 'idle',
  walk: 'walk',
  run: 'run',
  jump: 'jump',
  wave: 'wave',
  scared: 'defend',
  talk: 'idle'
});
const clean = (value, max = 120) => String(value ?? '').trim().slice(0, max);
const isRecord = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const normalizeAction = value => clean(value, 40).toLowerCase().replace(/[\s-]+/g, '_');

function findCharacterRig(rigs, characterId) {
  const wanted = clean(characterId).toLocaleLowerCase();
  return rigs.find(rig => clean(rig?.characterId).toLocaleLowerCase() === wanted) || null;
}

/**
 * Compile a Doodle-style action description into the project's existing
 * per-character bone timeline. This adapter does not render a second rig,
 * create a second LipSync system, or invent missing character assets.
 *
 * scene: { characters: string[], action?: string, characterActions?: Record<string,string> }
 * rigs: validated character rig definitions already owned by the scene/project.
 */
export function compileDoodleSceneMotion(sceneInput, rigInputs) {
  const scene = isRecord(sceneInput) ? sceneInput : {};
  const rigs = Array.isArray(rigInputs) ? rigInputs.slice(0, 20) : [];
  const characters = Array.isArray(scene.characters)
    ? [...new Set(scene.characters.map(id => clean(id)).filter(Boolean))]
    : [];
  const characterActions = isRecord(scene.characterActions) ? scene.characterActions : {};
  const actionByCharacter = new Map(Object.entries(characterActions)
    .map(([id, action]) => [clean(id).toLocaleLowerCase(), action]));
  const warnings = [];
  const prepared = [];

  if (!characters.length) {
    return {
      status: 'no-character-cast',
      timeline: null,
      animatedCharacterIds: [],
      warnings: ['No explicit character cast was supplied; motion was not assigned to an inferred character.']
    };
  }

  for (const characterId of characters.slice(0, 20)) {
    const rawAction = actionByCharacter.get(characterId.toLocaleLowerCase()) ?? scene.action;
    const action = normalizeAction(rawAction);
    const preset = ACTION_PRESETS[action];
    if (!preset) {
      warnings.push(`Unsupported Doodle action "${action || '(empty)'}" for ${characterId}; no motion was fabricated.`);
      continue;
    }
    const rig = findCharacterRig(rigs, characterId);
    if (!rig) {
      warnings.push(`No existing Character Rig found for ${characterId}; its motion was skipped.`);
      continue;
    }
    const result = createCharacterRigMotionPreset(rig, preset);
    if (result.status !== 'ready' || !result.timeline) {
      warnings.push(`Could not compile ${action} for ${characterId}: ${result.issues?.map(issue => issue.code).join(', ') || result.status}.`);
      continue;
    }
    prepared.push({ timeline: result.timeline, actorId: rig.characterId, action });
    for (const warning of result.warnings || []) warnings.push(`${characterId}: ${warning}`);
    if (action === 'talk') {
      warnings.push(`${characterId}: body motion uses idle; dialogue mouth movement remains controlled by the existing audio/viseme LipSync timeline.`);
    }
    if (action === 'scared') {
      warnings.push(`${characterId}: scared is mapped to the existing protective defend rig preset.`);
    }
  }

  if (!prepared.length) {
    return { status: 'no-compatible-rigs', timeline: null, animatedCharacterIds: [], warnings };
  }

  const times = [...new Set(prepared.flatMap(item => item.timeline.keyframes.map(frame => frame.time)))].sort((a, b) => a - b);
  const keyframes = times.map(time => {
    const poses = {};
    for (const item of prepared) {
      const sampled = sampleCharacterRigTimeline(item.timeline, time);
      const sampledId = Object.keys(sampled).find(id => id.toLocaleLowerCase() === item.actorId.toLocaleLowerCase());
      const characterPose = sampled[item.actorId] || (sampledId ? sampled[sampledId] : null);
      if (characterPose && Object.keys(characterPose).length) poses[item.actorId] = characterPose;
    }
    return { time, easing: 'linear', poses };
  });
  const report = validateCharacterRigTimeline({ schemaVersion: 1, keyframes });
  if (!report.passed) {
    return {
      status: 'invalid-combined-timeline',
      timeline: null,
      animatedCharacterIds: [],
      warnings: [...warnings, ...report.issues.map(issue => issue.message)]
    };
  }

  return {
    status: 'ready',
    timeline: report.timeline,
    animatedCharacterIds: prepared.map(item => item.actorId),
    actions: prepared.map(item => ({ characterId: item.actorId, action: item.action, preset: ACTION_PRESETS[item.action] })),
    warnings
  };
}

export const DOODLE_ACTION_PRESET_MAP = ACTION_PRESETS;

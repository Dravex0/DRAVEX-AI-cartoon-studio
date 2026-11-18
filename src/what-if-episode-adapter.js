/**
 * Import adapter for the What-if Kit episode.json format.
 *
 * This converts the kit's storyboard data into DRAVEX's provider-neutral scene model.
 * It does NOT run the kit's Remotion renderer, synthesize voice, or claim that props/poses
 * are rendered by DRAVEX. Unsupported visual instructions are retained in prompts/metadata
 * so they are not silently discarded.
 */
import { normalizeScene } from './scene-model.js';

const BACKGROUNDS = new Set([
  'room','bedroom','classroom','office','kitchen','shop','lab','stage','street',
  'rooftop','park','forest','beach','space','void','mountain'
]);
const CAMERA_SIZES = new Set(['wide','medium','close','extreme']);
const CAMERA_MOVES = new Set(['static','push','pull','pan-left','pan-right','drift','shake']);
const POSES = new Set([
  'stand','relaxed','point','point-up','point-back','wave','think','shrug','cheer',
  'facepalm','hold','hold-up','hold-out','carry','reach','catch','throw','phone',
  'read','type','sit','sit-ground','kneel','crouch','walk','run','sneak','jump',
  'fly','float','fall','lie','sleep','scared','cover-eyes','hands-hips','cross',
  'strong','punch','kick','push','pull','sad','look-up','bow','dance','dizzy',
  'proud','listen','count','drive','eat'
]);
const FX = new Set([
  'flash','darken','red','gold','speedlines','rain','snow','sparkles','confetti',
  'hearts','freeze','glitch','fade-in','fade-out'
]);
const text = (value, max = 2000) => String(value ?? '').trim().slice(0, max);
const ACTION_VERBS = Object.freeze({
  walk: 'walks', run: 'runs', jump: 'jumps', wave: 'waves',
  dance: 'dances', punch: 'attacks', kick: 'attacks',
  defend: 'defends', dodge: 'dodges'
});
function describeSupportedAction(actor, characterId) {
  const targetPose = text(actor?.toPose, 60).toLowerCase();
  const pose = text(actor?.pose, 60).toLowerCase();
  const action = ACTION_VERBS[targetPose] ? targetPose : pose;
  const verb = ACTION_VERBS[action];
  if (!verb) return '';
  const startX = Number(actor?.x), endX = Number(actor?.toX);
  const direction = Number.isFinite(startX) && Number.isFinite(endX) && startX !== endX
    ? (endX > startX ? 'to the right' : 'to the left') : '';
  return [text(characterId, 120) || 'the character', verb, direction].filter(Boolean).join(' ');
}

const list = value => Array.isArray(value) ? value : [];
const safeSlug = value => text(value, 80).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');

function estimateDuration(line, explicit) {
  const n = Number(explicit);
  if (Number.isFinite(n) && n >= 0.25 && n <= 30) return n;
  const words = text(line, 2000).split(/\s+/).filter(Boolean).length;
  return Math.max(1.5, Math.min(12, words / 2.6));
}

function describeActor(actor) {
  const who = text(actor?.who, 120) || 'unnamed character';
  const pose = text(actor?.pose, 60);
  const targetPose = text(actor?.toPose, 60);
  const mood = text(actor?.mood, 60);
  const movement = Number.isFinite(Number(actor?.toX))
    ? ` moves horizontally from ${actor?.x ?? 50}% to ${actor.toX}% of the frame`
    : '';
  const poseText = pose ? ` in ${pose} pose` : '';
  const changeText = targetPose ? ` and changes to ${targetPose}` : '';
  const moodText = mood ? ` with ${mood} expression` : '';
  return `${who}${poseText}${changeText}${moodText}${movement}`;
}

function describeProps(props) {
  return list(props).slice(0, 20).map(prop => {
    const type = text(prop?.type, 80);
    if (!type) return '';
    const x = Number.isFinite(Number(prop?.x)) ? ` at x=${prop.x}%` : '';
    const y = prop?.y != null ? ` y=${text(prop.y, 20)}` : '';
    const travel = Number.isFinite(Number(prop?.toX)) ? `, moving to x=${prop.toX}%` : '';
    return `${type}${x}${y}${travel}`;
  }).filter(Boolean).join('; ');
}

/**
 * @param {object} episode What-if Kit episode.json object.
 * @param {object} options Optional { characterMap: { kitId: dravexCharacterId } }.
 * @returns {{episode: object, scenes: object[], diagnostics: object}}
 */
export function convertWhatIfEpisode(input, options = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const shots = list(source.shots);
  const characterMap = options.characterMap && typeof options.characterMap === 'object'
    ? options.characterMap : {};
  const warnings = [];
  const errors = [];

  if (!shots.length) errors.push({ code: 'empty-episode', message: 'Episode must contain at least one shot.' });
  if (shots.length > 300) errors.push({ code: 'too-many-shots', message: 'Episode exceeds the 300-shot import safety limit.' });

  const scenes = shots.slice(0, 300).map((shot, index) => {
    const camera = shot?.camera && typeof shot.camera === 'object' ? shot.camera : {};
    const actors = list(shot?.actors).slice(0, 3);
    const actorIds = [...new Set(actors.map(actor => {
      const id = text(actor?.who, 120);
      return text(characterMap[id] ?? id, 120);
    }).filter(Boolean))];
    const background = text(shot?.bg, 80);
    const size = text(camera.size, 30);
    const move = text(camera.move, 30);
    const invalid = [];
    if (background && !BACKGROUNDS.has(background)) invalid.push(`background:${background}`);
    if (size && !CAMERA_SIZES.has(size)) invalid.push(`camera-size:${size}`);
    if (move && !CAMERA_MOVES.has(move)) invalid.push(`camera-move:${move}`);
    for (const actor of actors) {
      const pose = text(actor?.pose, 60);
      const toPose = text(actor?.toPose, 60);
      if (pose && !POSES.has(pose)) invalid.push(`pose:${pose}`);
      if (toPose && !POSES.has(toPose)) invalid.push(`pose:${toPose}`);
    }
    const effects = list(shot?.fx).map(value => text(value, 40)).filter(Boolean);
    for (const effect of effects) if (!FX.has(effect)) invalid.push(`effect:${effect}`);
    if (invalid.length) warnings.push({
      code: 'unsupported-kit-instruction',
      sceneIndex: index,
      details: [...new Set(invalid)],
      message: 'Some What-if visual tokens are not native DRAVEX render features; their descriptions are preserved in the scene prompts.'
    });

    const actorDescriptions = actors.map(describeActor).filter(Boolean);
    const propsDescription = describeProps(shot?.props);
    const cameraDescription = [
      size ? `${size} camera shot` : '',
      move && move !== 'static' ? `camera move: ${move}` : '',
      text(camera.on, 100) ? `camera focus: ${text(camera.on, 100)}` : ''
    ].filter(Boolean).join('; ');
    const visualParts = [
      background ? `Setting: ${background}.` : '',
      text(shot?.time, 30) ? `Time: ${text(shot.time, 30)}.` : '',
      cameraDescription ? `Camera: ${cameraDescription}.` : '',
      actorDescriptions.length ? `Characters: ${actorDescriptions.join('; ')}.` : '',
      propsDescription ? `Props: ${propsDescription}.` : '',
      effects.length ? `Requested effects: ${effects.join(', ')}.` : '',
      text(shot?.text?.value, 160) ? `On-screen text request: ${text(shot.text.value, 160)}.` : ''
    ].filter(Boolean);
    const action = [
      ...actorDescriptions,
      propsDescription ? `Props: ${propsDescription}` : '',
      effects.length ? `Effects: ${effects.join(', ')}` : ''
    ].filter(Boolean).join('. ');
    const narration = text(shot?.say, 2000);
    // Only map explicit, supported What-if poses to deterministic DRAVEX action presets.
    // Keep this as structured source evidence; do not infer movement from narration.
    const actionActor = actors.find(actor => {
      const targetPose = text(actor?.toPose, 60).toLowerCase();
      const pose = text(actor?.pose, 60).toLowerCase();
      return Boolean(ACTION_VERBS[targetPose] || ACTION_VERBS[pose]);
    });
    const actionActorId = actionActor
      ? text(characterMap[text(actionActor.who, 120)] ?? text(actionActor.who, 120), 120)
      : '';
    const actionEvidence = actionActor && actionActorId ? describeSupportedAction(actionActor, actionActorId) : '';
    const scene = normalizeScene({
      id: `whatif_${index + 1}`,
      order: index + 1,
      title: text(shot?.beat, 80) || `Shot ${index + 1}`,
      purpose: text(shot?.beat, 80),
      storyDetail: narration,
      sourceStoryText: narration,
      sourceEvents: [narration, actionEvidence].filter(Boolean),
      characters: actorIds,
      location: background,
      timeOfDay: text(shot?.time, 30),
      environmentDescription: background,
      visibleAction: action || 'Preserve the supplied What-if shot direction and generate a visible action.',
      actionTimeline: actionEvidence ? {
        schemaVersion: 1,
        phases: [{ phase: 'action', start: 0.1, end: 0.9, actorId: actionActorId, description: actionEvidence, evidence: actionEvidence }]
      } : null,
      camera: cameraDescription,
      startState: actorDescriptions.join('; '),
      endState: actorDescriptions.join('; '),
      durationSeconds: estimateDuration(narration, shot?.durationSeconds),
      prompt: visualParts.join(' '),
      imagePrompt: visualParts.join(' '),
      motionPrompt: action,
      negativePrompt: 'Do not omit the listed characters or the described visible action. Avoid static empty backgrounds.',
      continuityLock: actorIds.length ? `Keep character identity consistent: ${actorIds.join(', ')}.` : '',
      sound: (Array.isArray(shot?.sfx) ? shot.sfx : shot?.sfx ? [shot.sfx] : []).map(value => text(value, 60)).filter(Boolean).join(', '),
      transition: text(shot?.transition, 120)
    }, index);
    return scene;
  });

  return {
    episode: {
      slug: safeSlug(source.slug) || 'what-if-episode',
      title: text(source.title, 160) || 'Imported What-if episode',
      language: text(source.language, 12) || 'en',
      sourceFormat: 'what-if-kit-episode-json',
      sceneCount: scenes.length
    },
    scenes,
    diagnostics: { ok: errors.length === 0, errors, warnings }
  };
}

export const WHAT_IF_IMPORT_LIMITS = Object.freeze({
  maxShots: 300,
  maxActorsPerShot: 3,
  supportedBackgrounds: [...BACKGROUNDS],
  supportedCameraSizes: [...CAMERA_SIZES],
  supportedCameraMoves: [...CAMERA_MOVES],
  supportedPoses: [...POSES],
  supportedEffects: [...FX]
});

import { applyCharacterActionTimelineToLayers } from './character-action-runtime.js';
import { detectSceneAction } from './scene-action.js';
import { validateCharacterActionTimeline } from './character-action-timeline.js';
import { validateCharacterRig } from './character-rig.js';

export const ACTIONS = Object.freeze(['idle', 'walk', 'run', 'jump', 'wave', 'scared', 'talk', 'happy', 'sad', 'turn', 'dance', 'float']);
export const BACKGROUNDS = Object.freeze(['day', 'night', 'forest', 'city']);

const clamp = (value, min, max, fallback = min) => {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
};
const lerp = (a, b, p) => a + (b - a) * p;
const hash = value => {
  let result = 2166136261;
  for (const character of String(value ?? '')) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};
const key = value => String(value ?? '').trim().toLocaleLowerCase();
const record = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));

/**
 * Deterministic pose curves for the optional offline Doodle renderer.
 * This is procedural 2D animation, not neural video generation or pose inference.
 */
export function poseAt(action = 'idle', progress = 0, seed = 0) {
  const p = clamp(progress, 0, 1, 0);
  const phase = p * Math.PI * 2 + (hash(seed) % 6283) / 1000;
  const cue = ACTIONS.includes(action) ? action : 'idle';
  const speed = cue === 'run' ? 3.8 : cue === 'walk' ? 2.2 : cue === 'dance' ? 2.8 : 1.2;
  const swing = Math.sin(phase * speed);
  const small = Math.sin(phase * 1.4);
  const pose = {
    action: cue,
    bob: 0,
    lean: 0,
    leftArm: -0.18,
    rightArm: 0.18,
    leftLeg: 0,
    rightLeg: 0,
    headTilt: 0,
    tailSwing: small * 0.12,
    mouth: 0
  };
  if (cue === 'walk') {
    pose.bob = Math.abs(swing) * 0.035;
    pose.leftArm = -0.35 + swing * 0.48;
    pose.rightArm = 0.35 - swing * 0.48;
    pose.leftLeg = swing * 0.52;
    pose.rightLeg = -swing * 0.52;
    pose.lean = 0.05;
  } else if (cue === 'run') {
    pose.bob = Math.abs(swing) * 0.075;
    pose.leftArm = -0.75 + swing * 0.9;
    pose.rightArm = 0.75 - swing * 0.9;
    pose.leftLeg = swing * 0.95;
    pose.rightLeg = -swing * 0.95;
    pose.lean = 0.2;
  } else if (cue === 'jump') {
    pose.bob = -Math.sin(Math.PI * p) * 0.22;
    pose.leftArm = -1.65;
    pose.rightArm = 1.65;
    pose.leftLeg = -0.55;
    pose.rightLeg = 0.55;
  } else if (cue === 'wave') {
    pose.rightArm = -1.9 + Math.sin(phase * 4) * 0.28;
    pose.leftArm = 0.2;
    pose.bob = Math.abs(small) * 0.012;
  } else if (cue === 'scared') {
    pose.leftArm = -1.15 + small * 0.12;
    pose.rightArm = 1.15 - small * 0.12;
    pose.headTilt = small * 0.1;
    pose.bob = Math.sin(phase * 8) * 0.018;
  } else if (cue === 'talk') {
    pose.leftArm = -0.25 + small * 0.12;
    pose.rightArm = 0.25 - small * 0.12;
    pose.mouth = 0.12 + Math.max(0, Math.sin(phase * 5)) * 0.28;
  } else if (cue === 'happy') {
    pose.leftArm = -1.1;
    pose.rightArm = 1.1;
    pose.bob = Math.abs(swing) * 0.045;
    pose.headTilt = small * 0.06;
  } else if (cue === 'sad') {
    pose.leftArm = -0.08;
    pose.rightArm = 0.08;
    pose.headTilt = 0.16;
    pose.bob = Math.abs(small) * 0.008;
  } else if (cue === 'turn') {
    pose.headTilt = Math.sin(Math.PI * p) * 0.5;
    pose.lean = Math.sin(Math.PI * p) * 0.12;
  } else if (cue === 'dance') {
    pose.leftArm = -1.0 + swing * 0.35;
    pose.rightArm = 1.0 - swing * 0.35;
    pose.leftLeg = swing * 0.48;
    pose.rightLeg = -swing * 0.48;
    pose.bob = Math.abs(swing) * 0.06;
    pose.lean = Math.sin(phase * 2) * 0.1;
  } else if (cue === 'float') {
    pose.bob = -0.06 - Math.abs(small) * 0.08;
    pose.leftArm = -0.55;
    pose.rightArm = 0.55;
    pose.leftLeg = -0.16;
    pose.rightLeg = 0.16;
  } else {
    pose.bob = Math.sin(phase) * 0.012;
    pose.leftArm += small * 0.035;
    pose.rightArm -= small * 0.035;
  }
  return pose;
}

/** A small text envelope retained for legacy Doodle previews; production LipSync remains authoritative. */
export function mouthEnvelope(timeMs, durationMs) {
  const duration = Math.max(1, Number(durationMs) || 1);
  const time = Number(timeMs);
  if (!Number.isFinite(time) || time < 0 || time > duration) return 0;
  const normalized = time / duration;
  const envelope = Math.min(1, normalized * 7, (1 - normalized) * 7);
  return clamp(envelope * (0.35 + 0.65 * Math.abs(Math.sin(time / 68))), 0, 1, 0);
}

/** Parse the compact legacy Doodle line format: title | background | action | caption. */
export function parseStory(input) {
  return String(input ?? '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, index) => {
    const [title, background, action, caption, ...flags] = line.split('|').map(part => part.trim());
    return {
      id: 'doodle-' + (index + 1),
      title: title || 'Scene ' + (index + 1),
      background: BACKGROUNDS.includes(background) ? background : 'day',
      action: ACTIONS.includes(action) ? action : 'idle',
      caption: caption || '',
      flags: flags.filter(Boolean)
    };
  });
}

/** Clamp a Doodle scene to a short, phone-friendly duration. */
export function sceneDuration(value) {
  return clamp(value, 3, 10, 5);
}

function paletteFor(profile, characterId) {
  const description = [profile?.species, profile?.visualDescription, profile?.colors, characterId].join(' ').toLocaleLowerCase();
  if (/fox|лиса|лис|лисиц/.test(description)) return { fur: '#e97828', light: '#ffd2a1', dark: '#743b24', accent: '#f4a340', species: 'fox' };
  if (/bird|птиц|птах|авиан/.test(description)) return { fur: '#e9b83f', light: '#fff0b0', dark: '#59431c', accent: '#e87936', species: 'bird' };
  if (/robot|робот|android|андроид/.test(description)) return { fur: '#79b7c9', light: '#d8f3fa', dark: '#294d68', accent: '#e4b94f', species: 'robot' };
  if (/rabbit|bunny|крол|заяц|зайц/.test(description)) return { fur: '#d7b8a7', light: '#fff0e4', dark: '#60483d', accent: '#c9788c', species: 'rabbit' };
  const colors = ['#70a8cf', '#a78bd1', '#71b58c', '#d18a79', '#c0a45e'];
  const color = colors[hash(characterId) % colors.length];
  return { fur: color, light: '#f5e8d6', dark: '#344052', accent: '#e6b45b', species: 'generic' };
}

function drawLimb(context, x1, y1, x2, y2, x3, y3, width, color) {
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  if (Number.isFinite(x3) && Number.isFinite(y3)) context.lineTo(x3, y3);
  context.stroke();
}

/** Draw one expressive full-body vector actor; coordinates are its visual centre. */
export function drawFigure(context, pose = {}, options = {}) {
  if (!context || typeof context.save !== 'function' || typeof context.beginPath !== 'function') return false;
  const x = Number(options.x), y = Number(options.y);
  const size = clamp(options.size, 24, 1200, 220);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const profile = record(options.profile) ? options.profile : {};
  const characterId = String(options.characterId || 'actor');
  const colors = paletteFor(profile, characterId);
  const mouth = clamp(options.mouthOpenness ?? pose.mouth, 0, 1, 0);
  const unit = size / 220;
  const p = pose || {};
  context.save();
  try {
    context.translate(x, y + (Number(p.bob) || 0) * size);
    context.rotate(clamp(p.lean, -0.5, 0.5, 0));
    context.scale(unit, unit);
    // Tail is drawn first so the body naturally occludes its attachment.
    if (colors.species === 'fox' || colors.species === 'rabbit') {
      context.save();
      context.translate(-27, 20);
      context.rotate(Number(p.tailSwing) || 0);
      context.fillStyle = colors.fur;
      context.beginPath();
      context.ellipse(-30, 4, 33, 13, -0.35, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = colors.light;
      context.beginPath();
      context.ellipse(-54, 1, 10, 8, -0.35, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    // Legs and shoes.
    drawLimb(context, -12, 49, -18 + Math.sin(p.leftLeg || 0) * 17, 82, -24 + Math.sin(p.leftLeg || 0) * 22, 91, 12, colors.dark);
    drawLimb(context, 12, 49, 18 + Math.sin(p.rightLeg || 0) * 17, 82, 24 + Math.sin(p.rightLeg || 0) * 22, 91, 12, colors.dark);
    // Arms use the same pose clock as the body and legs.
    drawLimb(context, -25, -7, -48 + Math.sin(p.leftArm || 0) * 20, 12, -55 + Math.sin(p.leftArm || 0) * 27, 34, 10, colors.dark);
    drawLimb(context, 25, -7, 48 + Math.sin(p.rightArm || 0) * 20, 12, 55 + Math.sin(p.rightArm || 0) * 27, 34, 10, colors.dark);
    // Torso.
    context.fillStyle = colors.fur;
    context.beginPath();
    context.ellipse(0, 18, 29, 39, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = colors.light;
    context.beginPath();
    context.ellipse(0, 26, 16, 25, 0, 0, Math.PI * 2);
    context.fill();
    // Head and species silhouette.
    context.save();
    context.translate(0, -48);
    context.rotate(Number(p.headTilt) || 0);
    context.fillStyle = colors.fur;
    if (colors.species === 'robot') {
      context.fillRect(-27, -27, 54, 52);
      context.fillStyle = colors.accent;
      context.fillRect(-33, -34, 66, 8);
    } else {
      if (colors.species === 'fox' || colors.species === 'rabbit') {
        context.beginPath();
        context.moveTo(-23, -15); context.lineTo(-30, -54); context.lineTo(-4, -31);
        context.closePath(); context.fill();
        context.beginPath();
        context.moveTo(23, -15); context.lineTo(30, -54); context.lineTo(4, -31);
        context.closePath(); context.fill();
      }
      context.beginPath();
      context.arc(0, 0, 29, 0, Math.PI * 2);
      context.fill();
    }
    if (colors.species === 'bird') {
      context.fillStyle = colors.accent;
      context.beginPath(); context.moveTo(25, -2); context.lineTo(48, 4); context.lineTo(25, 10); context.closePath(); context.fill();
    }
    context.fillStyle = colors.light;
    context.beginPath();
    context.ellipse(0, 11, colors.species === 'fox' ? 16 : 19, 13, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = colors.dark;
    context.beginPath(); context.arc(-10, -3, 3.2, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.arc(10, -3, 3.2, 0, Math.PI * 2); context.fill();
    context.fillStyle = colors.dark;
    if (mouth > 0.16) {
      context.beginPath(); context.ellipse(0, 14, 4 + mouth * 4, 2 + mouth * 8, 0, 0, Math.PI * 2); context.fill();
    } else {
      context.strokeStyle = colors.dark; context.lineWidth = 2.5;
      context.beginPath(); context.moveTo(-5, 14); context.quadraticCurveTo(0, 18, 5, 14); context.stroke();
    }
    context.restore();
  } finally {
    context.restore();
  }
  return true;
}

function activeActorStep(scene, actorId, progress) {
  if (!validateCharacterActionTimeline(scene).passed) return null;
  const phases = Array.isArray(scene?.actionTimeline?.phases) ? scene.actionTimeline.phases : [];
  for (const phase of phases) {
    const steps = Array.isArray(phase.steps) && phase.steps.length ? phase.steps : [phase];
    for (const step of steps) {
      const actor = key(step.actorId || phase.actorId);
      const start = Number(step.start), end = Number(step.end);
      if (actor !== key(actorId) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      if (progress < start || progress > end) continue;
      return { step, phase, localProgress: clamp((progress - start) / (end - start), 0, 1, 0) };
    }
  }
  return null;
}

function castOf(scene) {
  const raw = Array.isArray(scene?.characters) ? scene.characters : [];
  const seen = new Set();
  return raw.map(value => String(value ?? '').trim()).filter(value => {
    const normalized = key(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  }).slice(0, 12);
}

/** Create non-image actor anchors for characters that do not already have a sprite or rig. */
export function createProceduralActorLayers(scene = {}, progress = 0) {
  const cast = castOf(scene);
  const layers = Array.isArray(scene?.characterLayers) ? scene.characterLayers : [];
  const layerIds = new Set(layers.map(layer => key(layer?.characterId)));
  const rigIds = new Set((Array.isArray(scene?.characterRigs) ? scene.characterRigs : [])
    .filter(rig => validateCharacterRig(rig).passed).map(rig => key(rig.characterId)));
  const fallback = cast.filter(id => !layerIds.has(key(id)) && !rigIds.has(key(id)));
  const anchors = fallback.map((characterId, index) => ({
    characterId,
    x: fallback.length === 1 ? 0.5 : 0.28 + index * (0.44 / Math.max(1, fallback.length - 1)),
    y: 0.7,
    width: 0.25,
    height: 0.42,
    scale: 1,
    rotation: 0,
    opacity: 1,
    flipX: false,
    visible: true,
    procedural: true
  }));
  const motion = scene?.characterMotionTimeline;
  return motion ? applyCharacterActionTimelineToLayers(anchors, motion, progress) : anchors;
}

/**
 * Draw procedural actors only where authored sprites/rigs are missing.
 * Existing scene background, prop renderer, rig renderer and production LipSync remain shared.
 */
export function drawProceduralSceneActors(context, scene = {}, runtime = {}) {
  const width = Number(runtime.width), height = Number(runtime.height);
  const progress = clamp(runtime.progress, 0, 1, 0);
  if (!context || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { drawn: 0, layers: [], skipped: 0 };
  }
  const cast = castOf(scene);
  const layers = createProceduralActorLayers(scene, progress);
  const profileById = new Map((Array.isArray(runtime.characterBible) ? runtime.characterBible : [])
    .filter(record).map(profile => [key(profile.characterId), profile]));
  const mouthById = runtime.facialMouthOpenness && typeof runtime.facialMouthOpenness === 'object'
    ? runtime.facialMouthOpenness : {};
  const visemes = runtime.facialVisemes && typeof runtime.facialVisemes === 'object'
    ? runtime.facialVisemes : {};
  let drawn = 0, skipped = 0;
  for (const layer of layers) {
    const active = activeActorStep(scene, layer.characterId, progress);
    const step = active?.step;
    const actionText = String(step?.description || step?.intent || '');
    const requestedCue = String(step?.motionCue || '').trim();
    const action = ACTIONS.includes(requestedCue) ? requestedCue : detectSceneAction(actionText);
    const pose = poseAt(action, active?.localProgress ?? progress, layer.characterId);
    const mouthValue = mouthById[layer.characterId] ?? mouthById[key(layer.characterId)];
    const mouth = Number.isFinite(Number(mouthValue)) ? Number(mouthValue) : pose.mouth;
    const profile = profileById.get(key(layer.characterId)) || {};
    const viseme = String(visemes[layer.characterId] ?? visemes[key(layer.characterId)] ?? '');
    const mouthOpenness = /(?:AA|AE|AH|AO|AW|EH|ER|IH|IY|OH|OW|UH|UW|open)/i.test(viseme)
      ? Math.max(mouth, 0.55) : mouth;
    const size = Math.min(width * layer.width, height * layer.height);
    const x = layer.x * width;
    const y = layer.y * height;
    if (drawFigure(context, pose, {
      x, y, size, profile, characterId: layer.characterId, mouthOpenness
    })) drawn++;
    else skipped++;
  }
  return { drawn, layers, skipped, castCount: cast.length };
}

/** Standalone Doodle scene for legacy callers; production app uses its shared scene renderer. */
export function drawScene(context, scene = {}, runtime = {}) {
  if (!context || typeof context.fillRect !== 'function') return { drawn: 0, skipped: 0 };
  const width = Number(runtime.width || context.canvas?.width || 640);
  const height = Number(runtime.height || context.canvas?.height || 360);
  const background = BACKGROUNDS.includes(scene.background) ? scene.background : 'day';
  const colors = {
    day: ['#8fd3f4', '#e8f7ff'], night: ['#101d3d', '#283b68'],
    forest: ['#78b86c', '#214e3b'], city: ['#a6b7ca', '#4b5c75']
  }[background];
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, colors[0]); gradient.addColorStop(1, colors[1]);
  context.fillStyle = gradient; context.fillRect(0, 0, width, height);
  const cast = castOf({ characters: scene.characterId ? [scene.characterId] : ['Doodle'] });
  const profile = scene.profile || {};
  const pose = poseAt(scene.action || 'idle', runtime.progress ?? 0.5, scene.characterId || 'Doodle');
  drawFigure(context, pose, { x: width / 2, y: height * 0.68, size: Math.min(width * 0.4, height * 0.65), profile, characterId: cast[0] });
  if (scene.caption) {
    context.fillStyle = '#ffffff'; context.font = 'bold 18px sans-serif'; context.textAlign = 'center';
    context.fillText(String(scene.caption).slice(0, 180), width / 2, height - 18, width - 24);
  }
  return { drawn: 1, skipped: 0 };
}

import { validateCharacterActionTimeline } from './character-action-timeline.js';
import { detectSceneAction } from './scene-action.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clean = value => String(value ?? '').trim();
const key = value => clean(value).toLocaleLowerCase();
const isRecord = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));

function directionOf(description) {
  const text = String(description ?? '').normalize('NFKC').toLocaleLowerCase();
  if (/\\b(right|east)\\b|вправо|праворуч|направо|\\bderecha\\b/.test(text)) return 'right';
  if (/\\b(left|west)\\b|влево|ліворуч|налево|\\bizquierda\\b/.test(text)) return 'left';
  if (/\\b(up|upward|upwards|above)\\b|вверх|угору|вгору|\\barriba\\b/.test(text)) return 'up';
  if (/\\b(down|downward|downwards|below)\\b|вниз|донизу|\\babajo\\b/.test(text)) return 'down';
  return null;
}

function basePose(layer) {
  return {
    x: Number.isFinite(layer.x) ? layer.x : 0.5,
    y: Number.isFinite(layer.y) ? layer.y : 0.68,
    scale: Number.isFinite(layer.scale) ? layer.scale : 1,
    rotation: Number.isFinite(layer.rotation) ? layer.rotation : 0,
    opacity: Number.isFinite(layer.opacity) ? layer.opacity : 1
  };
}

function phase(actorId, start, end, from, to, source, suffix = '') {
  return {
    phase: 'action',
    actorId,
    start,
    end,
    description: clean(source.description) + suffix,
    evidence: source.evidence,
    motion: { from: { ...from }, to: { ...to } },
    generatedBy: 'rule-based-story-motion-planner'
  };
}

/**
 * Creates conservative sprite transforms from a validated, source-grounded action timeline.
 * This is deterministic lexical planning, not an AI model or pose/limb animation.
 */
export function planCharacterMotionFromActionTimeline(scene = {}, layers = []) {
  if (!Array.isArray(layers) || !layers.length) {
    return { status: 'blocked', reason: 'No character sprite layers are attached to this scene.', timeline: null, generatedCount: 0, skipped: [] };
  }
  const validation = validateCharacterActionTimeline(scene);
  if (!validation.passed) {
    return { status: 'blocked', reason: 'The scene action timeline must pass story, cast, timing, and evidence checks first.', timeline: null, generatedCount: 0, skipped: validation.issues.map(item => item.code) };
  }

  const layerById = new Map(layers.filter(isRecord).map(layer => [key(layer.characterId), layer]));
  const poses = new Map([...layerById].map(([id, layer]) => [id, basePose(layer)]));
  const phases = [];
  const skipped = [];

  for (const source of scene.actionTimeline.phases) {
    const actorId = clean(source.actorId);
    const actorKey = key(actorId);
    const actorLayer = layerById.get(actorKey);
    if (!actorLayer) {
      skipped.push({ actorId, phase: source.phase, reason: 'actor-sprite-missing' });
      continue;
    }
    const description = clean(source.description);
    const action = detectSceneAction(description);
    const direction = directionOf(description);
    const from = { ...(poses.get(actorKey) || basePose(actorLayer)) };
    let to = { ...from };
    let plan = null;

    if ((action === 'walk' || action === 'run') && source.targetId && layerById.has(key(source.targetId))) {
      const target = poses.get(key(source.targetId)) || basePose(layerById.get(key(source.targetId)));
      const dx = target.x - from.x, dy = target.y - from.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0.08) {
        const travel = Math.min(action === 'run' ? 0.3 : 0.18, distance - 0.06);
        const ratio = travel / distance;
        to.x = clamp(from.x + dx * ratio, 0.05, 0.95);
        to.y = clamp(from.y + dy * ratio, 0.05, 0.95);
        plan = [phase(actorId, source.start, source.end, from, to, source, ' (move toward the named character target)')];
      }
    } else if ((action === 'walk' || action === 'run') && direction) {
      const distance = action === 'run' ? 0.24 : 0.14;
      if (direction === 'right') to.x = clamp(from.x + distance, 0.05, 0.95);
      if (direction === 'left') to.x = clamp(from.x - distance, 0.05, 0.95);
      if (direction === 'up') to.y = clamp(from.y - distance, 0.05, 0.95);
      if (direction === 'down') to.y = clamp(from.y + distance, 0.05, 0.95);
      plan = [phase(actorId, source.start, source.end, from, to, source, ' (move in the explicitly stated direction)')];
    } else if (action === 'jump') {
      const apex = { ...from, y: clamp(from.y - 0.14, 0.05, 0.95), scale: clamp(from.scale * 1.04, 0.05, 4) };
      const midpoint = (source.start + source.end) / 2;
      plan = [
        phase(actorId, source.start, midpoint, from, apex, source, ' (jump: rise)'),
        phase(actorId, midpoint, source.end, apex, from, source, ' (jump: land)')
      ];
      to = from;
    } else if (action === 'turn' && /turns? around|поворот на месте|разворачивается|розвертається|обертається навколо себе|gira sobre sí mismo/i.test(description)) {
      to.rotation = from.rotation + Math.PI;
      plan = [phase(actorId, source.start, source.end, from, to, source, ' (turn around)')];
    } else if (action === 'turn' && direction === 'left') {
      to.rotation = from.rotation - Math.PI / 4;
      plan = [phase(actorId, source.start, source.end, from, to, source, ' (turn left)')];
    } else if (action === 'turn' && direction === 'right') {
      to.rotation = from.rotation + Math.PI / 4;
      plan = [phase(actorId, source.start, source.end, from, to, source, ' (turn right)')];
    } else if (action === 'float' && (direction === 'up' || direction === 'down')) {
      to.y = clamp(from.y + (direction === 'up' ? -0.16 : 0.16), 0.05, 0.95);
      plan = [phase(actorId, source.start, source.end, from, to, source, ' (float in the explicitly stated direction)')];
    } else if (action === 'vanish') {
      to.opacity = 0;
      plan = [phase(actorId, source.start, source.end, from, to, source, ' (fade out)')];
    }

    if (!plan) {
      skipped.push({ actorId, phase: source.phase, action, reason: 'motion-not-unambiguous' });
      continue;
    }
    phases.push(...plan);
    poses.set(actorKey, { ...to });
  }

  if (!phases.length) {
    return {
      status: 'no-unambiguous-motion',
      reason: 'No supported, unambiguous sprite movement was found. Add a direction or a named character target to the action description.',
      timeline: null,
      generatedCount: 0,
      skipped
    };
  }
  phases.sort((a, b) => a.start - b.start || a.end - b.end || a.actorId.localeCompare(b.actorId));
  return {
    status: skipped.length ? 'partial' : 'generated',
    timeline: { schemaVersion: 1, phases },
    generatedCount: phases.length,
    skipped,
    limitations: [
      'Uses deterministic action keywords, explicit directions, and named character targets.',
      'Does not infer unseen directions, body joints, facial expressions, or contact poses.',
      'Moves whole character sprites; it does not create skeletal or frame-by-frame animation.'
    ]
  };
}

import { applyCharacterRigPose, validateCharacterRig } from './character-rig.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clean = value => String(value ?? '').trim();
const key = value => clean(value).toLocaleLowerCase();

function propKind(name) {
  const value = key(name);
  if (/star|звезд|зірк|estrella/.test(value)) return 'star';
  if (/key|ключ|ключик|llave/.test(value)) return 'key';
  if (/book|книг|книж|libro/.test(value)) return 'book';
  if (/ball|мяч|куля|pelota/.test(value)) return 'ball';
  if (/apple|яблок|яблук|manzana/.test(value)) return 'apple';
  if (/bird|птиц|пташ|pájaro|ave/.test(value)) return 'bird';
  if (/branch|ветк|гілк|rama/.test(value)) return 'branch';
  return 'generic';
}

/**
 * Resolve an explicitly named hand/paw anchor from the same posed rig used by the renderer.
 * Returns null rather than guessing when the rig has no unambiguous contact part.
 */
export function resolveCharacterPropAnchor(characterId, rigs = [], rigPoses = {}) {
  const actorKey = key(characterId);
  if (!actorKey || !Array.isArray(rigs)) return null;
  const input = rigs.find(candidate => key(candidate?.characterId) === actorKey);
  if (!input) return null;
  const report = validateCharacterRig(input);
  if (!report.passed) return null;
  const pose = Object.entries(rigPoses && typeof rigPoses === 'object' ? rigPoses : {})
    .find(([id]) => key(id) === actorKey)?.[1] || {};
  const posedParts = applyCharacterRigPose(report.rig.parts, report.rig, pose);
  const anchors = posedParts.filter(part => /hand|paw|wrist| кист|лап/i.test(part.id)
    || /hand|paw|wrist|кисть|лап/i.test(part.boneId));
  if (anchors.length !== 1) return null;
  const anchor = anchors[0];
  if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)
    || anchor.x < 0 || anchor.x > 1 || anchor.y < 0 || anchor.y > 1) return null;
  const rotation = Number.isFinite(anchor.rotation) ? anchor.rotation : 0;
  const gripX = Number.isFinite(anchor.gripOffsetX) ? anchor.gripOffsetX : 0;
  const gripY = Number.isFinite(anchor.gripOffsetY) ? anchor.gripOffsetY : 0;
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  const x = anchor.x + cos * gripX - sin * gripY;
  const y = anchor.y + sin * gripX + cos * gripY;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y, rotation, partId: anchor.id };
}


/** Resolve only explicitly authored normalized scene coordinates for a named prop. */
export function resolveScenePropAnchor(scene = {}, entityId) {
  const anchors = scene?.propAnchors;
  if (!anchors || typeof anchors !== 'object' || Array.isArray(anchors)) return null;
  const wanted = key(entityId);
  if (!wanted) return null;
  const entry = Object.entries(anchors).find(([id]) => key(id) === wanted)?.[1];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)
    || !Number.isFinite(entry.x) || !Number.isFinite(entry.y)
    || entry.x < 0 || entry.x > 1 || entry.y < 0 || entry.y > 1) return null;
  return { x: entry.x, y: entry.y };
}

/**
 * Builds a deterministic visual plan from explicit, source-grounded prop holder changes.
 * Uses the authored action phase when available; older scenes use a deterministic
 * latter-half fallback because state changes do not carry their own event timestamps.
 */
export function buildScenePropRenderPlan(scene = {}, characterLayers = [], progress = 1, runtime = {}) {
  const changes = Array.isArray(scene?.stateChanges) ? scene.stateChanges : [];
  const layers = Array.isArray(characterLayers) ? characterLayers : [];
  const p = clamp(Number.isFinite(progress) ? progress : 1, 0, 1);
  const actionPhases = Array.isArray(scene?.actionTimeline?.phases)
    ? scene.actionTimeline.phases.filter(phase =>
      Number.isFinite(phase?.start) && Number.isFinite(phase?.end)
      && phase.start >= 0 && phase.start < phase.end && phase.end <= 1)
    : [];
  const actionPhase = actionPhases.find(phase => phase.phase === 'action') || null;
  const latestHolders = new Map();
  const latestStates = new Map();
  for (const change of changes) {
    if (!change || change.entityType !== 'prop') continue;
    const entityId = clean(change.entityId);
    if (!entityId) continue;
    if (change.property === 'holder') latestHolders.set(key(entityId), change);
    if (change.property === 'state' && ['trapped', 'free', 'fallen', 'lifted'].includes(key(change.value))) {
      latestStates.set(key(entityId), change);
    }
  }

  const holderPlans = [...latestHolders.values()].map(change => {
    const actorId = clean(change.actorId);
    const actor = layers.find(layer => key(layer?.characterId) === key(actorId));
    const actorX = Number.isFinite(actor?.x) ? actor.x : 0.5;
    const actorY = Number.isFinite(actor?.y) ? actor.y : 0.68;
    const heldByActor = change.value != null && key(change.value) === key(actorId);
    const wasHeldByActor = change.previousValue != null && key(change.previousValue) === key(actorId);
    const ground = resolveScenePropAnchor(scene, change.entityId) || { x: 0.68, y: 0.79 };
    const rigAnchor = resolveCharacterPropAnchor(actorId, runtime.characterRigs, runtime.rigPoses);
    const hand = rigAnchor
      ? { x: rigAnchor.x, y: rigAnchor.y, rotation: rigAnchor.rotation }
      : { x: clamp(actorX + (actor?.flipX ? -0.12 : 0.12), 0.04, 0.96), y: clamp(actorY - 0.08, 0.08, 0.9), rotation: 0 };
    const propPhase = actionPhases.find(phase => key(phase.targetId) === key(change.entityId)) || actionPhase;
    const transitionStart = propPhase ? propPhase.start : 0.52;
    const transitionEnd = propPhase ? propPhase.end : 0.8;
    const transition = clamp((p - transitionStart) / (transitionEnd - transitionStart), 0, 1);
    const eased = transition * transition * (3 - 2 * transition);
    const from = wasHeldByActor ? hand : ground;
    const to = heldByActor ? hand : ground;
    const x = from.x + (to.x - from.x) * eased;
    const y = from.y + (to.y - from.y) * eased;
    const rotation = (from.rotation || 0) + ((to.rotation || 0) - (from.rotation || 0)) * eased;
    return {
      id: clean(change.entityId),
      kind: propKind(change.entityId),
      x, y, rotation,
      held: heldByActor,
      visible: true,
      scale: 1,
      evidence: clean(change.evidence)
    };
  });

  // A prop whose state changes but is not held still needs a visible representation.
  // Only render it when the planner/provider supplied an explicit anchor; never guess
  // where a trapped or released object belongs in the composition.
  const statePlans = [...latestStates.values()]
    .filter(change => !latestHolders.has(key(change.entityId)))
    .flatMap(change => {
      const anchor = resolveScenePropAnchor(scene, change.entityId);
      if (!anchor) return [];
      const propPhase = actionPhases.find(phase => key(phase.targetId) === key(change.entityId)) || actionPhase;
      const transitionStart = propPhase ? propPhase.start : 0.52;
      const transitionEnd = propPhase ? propPhase.end : 0.8;
      const transition = clamp((p - transitionStart) / (transitionEnd - transitionStart), 0, 1);
      const eased = transition * transition * (3 - 2 * transition);
      const isFree = key(change.value) === 'free';
      return [{
        id: clean(change.entityId),
        kind: propKind(change.entityId),
        x: anchor.x,
        y: anchor.y - (isFree ? 0.045 * eased : 0),
        rotation: isFree ? -0.12 * eased : 0,
        held: false,
        state: key(change.value),
        visible: true,
        scale: 1,
        evidence: clean(change.evidence)
      }];
    });

  return [...holderPlans, ...statePlans];
}

function drawStar(context, size) {
  context.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const radius = i % 2 ? size * 0.45 : size;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
  }
  context.closePath();
  context.fill();
}

function drawProp(context, prop, x, y, time, unitScale = 1) {
  const bob = prop.held ? Math.sin(time * 4) * 0.008 : prop.state === 'free' ? Math.sin(time * 5) * 0.006 : 0;
  context.save();
  context.translate(x, y + bob);
  context.scale(unitScale, unitScale);
  context.rotate(Number.isFinite(prop.rotation) ? prop.rotation : 0);
  context.lineWidth = 2.5 / unitScale;
  context.lineJoin = 'round';
  if (prop.kind === 'bird') {
    context.fillStyle = prop.state === 'trapped' ? '#91a7b1' : '#a9dce5'; context.strokeStyle = '#365966';
    context.beginPath(); context.ellipse(0, 0.002, 0.022, 0.014, 0, 0, Math.PI * 2); context.fill(); context.stroke();
    context.beginPath(); context.ellipse(-0.004, -0.006, 0.011, 0.006, -0.35, 0, Math.PI * 2); context.fill(); context.stroke();
    context.fillStyle = '#d8edf0'; context.beginPath(); context.arc(0.016, -0.009, 0.009, 0, Math.PI * 2); context.fill(); context.stroke();
    context.fillStyle = '#243b45'; context.beginPath(); context.arc(0.019, -0.011, 0.0022, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#e5a94f'; context.beginPath(); context.moveTo(0.024, -0.007); context.lineTo(0.035, -0.003); context.lineTo(0.024, 0.001); context.closePath(); context.fill();
    context.strokeStyle = '#7eabb7'; context.beginPath(); context.moveTo(-0.016, 0.012); context.lineTo(-0.021, 0.019); context.moveTo(-0.006, 0.014); context.lineTo(-0.008, 0.02); context.stroke();
  } else if (prop.kind === 'branch') {
    context.strokeStyle = '#775435'; context.lineWidth = 6 / unitScale;
    context.beginPath(); context.moveTo(-0.04, 0.012); context.lineTo(-0.017, -0.006);
    context.lineTo(0.005, 0.006); context.lineTo(0.025, -0.014);
    context.moveTo(-0.017, -0.006); context.lineTo(-0.024, -0.023);
    context.moveTo(0.005, 0.006); context.lineTo(0.014, 0.026);
    context.stroke();
    context.strokeStyle = '#9b754a'; context.lineWidth = 2 / unitScale;
    context.beginPath(); context.moveTo(-0.035, 0.009); context.lineTo(-0.015, -0.005); context.lineTo(0.005, 0.006); context.stroke();
  } else if (prop.kind === 'star') {
    context.fillStyle = '#ffe58a'; context.strokeStyle = '#9b6b24';
    drawStar(context, 0.027);
    context.stroke();
  } else if (prop.kind === 'key') {
    context.strokeStyle = '#f6d36b'; context.fillStyle = '#f6d36b';
    context.beginPath(); context.arc(-0.012, 0, 0.012, 0, Math.PI * 2); context.stroke();
    context.fillRect(-0.002, -0.003, 0.035, 0.006);
    context.fillRect(0.022, -0.003, 0.005, 0.014);
  } else if (prop.kind === 'book') {
    context.fillStyle = '#c86f52'; context.strokeStyle = '#5a3540';
    context.fillRect(-0.025, -0.018, 0.05, 0.036); context.strokeRect(-0.025, -0.018, 0.05, 0.036);
    context.strokeStyle = '#f5d9a8'; context.beginPath(); context.moveTo(0, -0.016); context.lineTo(0, 0.016); context.stroke();
  } else if (prop.kind === 'ball') {
    context.fillStyle = '#72c6df'; context.strokeStyle = '#24566c';
    context.beginPath(); context.arc(0, 0, 0.022, 0, Math.PI * 2); context.fill(); context.stroke();
    context.beginPath(); context.arc(0, 0, 0.011, 0, Math.PI * 2); context.stroke();
  } else if (prop.kind === 'apple') {
    context.fillStyle = '#df5b50'; context.strokeStyle = '#783a37';
    context.beginPath(); context.ellipse(0, 0.003, 0.019, 0.022, 0, 0, Math.PI * 2); context.fill(); context.stroke();
    context.strokeStyle = '#6e8b4d'; context.beginPath(); context.moveTo(0, -0.018); context.lineTo(0.004, -0.029); context.stroke();
  } else {
    context.fillStyle = '#e7b66b'; context.strokeStyle = '#775735';
    context.beginPath(); context.roundRect(-0.021, -0.018, 0.042, 0.036, 0.008); context.fill(); context.stroke();
  }
  context.restore();
}

/** Draws explicit story props in the shared Canvas preview/export path. */
export function drawSceneProps(context, scene, characterLayers, progress, width, height, time = 0, runtime = {}) {
  if (!context || typeof context.save !== 'function' || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { drawn: 0, skipped: 0 };
  }
  const plan = buildScenePropRenderPlan(scene, characterLayers, progress, runtime);
  const unitScale = Math.max(1, Math.min(width, height));
  for (const prop of plan) drawProp(context, prop, prop.x * width, prop.y * height, Number.isFinite(time) ? time : 0, unitScale);
  return { drawn: plan.length, skipped: 0, props: plan };
}

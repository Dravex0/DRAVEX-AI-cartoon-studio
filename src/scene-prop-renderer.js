import { applyCharacterRigPose, validateCharacterRig } from './character-rig.js';
import { buildScenePhysicsModel } from './scene-physics-model.js';
import { buildGroundedPhysicsVisualPlan } from './scene-physics-visual-bridge.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clean = value => String(value ?? '').trim();
const key = value => clean(value).toLocaleLowerCase();
const normalizedPoint = value => value && typeof value === 'object' && !Array.isArray(value)
  && Number.isFinite(value.x) && value.x >= 0 && value.x <= 1
  && Number.isFinite(value.y) && value.y >= 0 && value.y <= 1
  ? { x: value.x, y: value.y } : null;

function propKind(name) {
  const value = key(name);
  if (/star|звезд|зірк|estrella/.test(value)) return 'star';
  if (/key|ключ|ключик|llave/.test(value)) return 'key';
  if (/book|книг|книж|libro/.test(value)) return 'book';
  if (/ball|мяч|куля|pelota/.test(value)) return 'ball';
  if (/apple|яблок|яблук|manzana/.test(value)) return 'apple';
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
  const handParts = posedParts.filter(part => /hand|paw|wrist| кист|лап/i.test(part.id)
    || /hand|paw|wrist|кисть|лап/i.test(part.boneId));
  // Rigs with two hands need an explicit grip/contact anchor. Never choose
  // left or right arbitrarily: that would make held props jump to the wrong hand.
  const semanticGripParts = handParts.filter(part => part.gripAnchor === true);
  const authoredGripParts = semanticGripParts.length
    ? semanticGripParts
    : handParts.filter(part => /grip|propanchor|contacthand|holdinghand/i.test(part.id));
  const anchors = authoredGripParts.length ? authoredGripParts : handParts;
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

/**
 * Builds a deterministic visual plan from explicit, source-grounded prop holder changes.
 * Uses the authored action phase when available; older scenes use a deterministic
 * latter-half fallback because state changes do not carry their own event timestamps.
 */
export function buildScenePropRenderPlan(scene = {}, characterLayers = [], progress = 1, runtime = {}) {
  const changes = Array.isArray(scene?.stateChanges) ? scene.stateChanges : [];
  const layers = Array.isArray(characterLayers) ? characterLayers : [];
  const p = clamp(Number.isFinite(progress) ? progress : 1, 0, 1);
  const actionPhase = Array.isArray(scene?.actionTimeline?.phases)
    ? scene.actionTimeline.phases.find(phase => phase?.phase === 'action'
      && Number.isFinite(phase.start) && Number.isFinite(phase.end)
      && phase.start >= 0 && phase.start < phase.end && phase.end <= 1)
    : null;
  const phaseStart = actionPhase ? actionPhase.start : 0.52;
  const phaseEnd = actionPhase ? actionPhase.end : 0.8;
  const timelineSteps = (Array.isArray(scene?.actionTimeline?.phases) ? scene.actionTimeline.phases : [])
    .flatMap(phase => Array.isArray(phase?.steps) ? phase.steps.map(step => ({
      ...step,
      actorId: clean(step.actorId) || clean(phase.actorId),
      targetId: clean(step.targetId) || clean(phase.targetId),
      evidence: clean(step.evidence) || clean(phase.evidence)
    })) : [])
    .filter(step => Number.isFinite(step?.start) && Number.isFinite(step?.end)
      && step.start >= 0 && step.start < step.end && step.end <= 1);
  const matchActionStep = (change, compatibleIntents, claimed) => {
    const intent = clean(change?.actionIntent);
    if (!intent) return null;
    const actorId = key(change.actorId);
    const targetId = key(change.entityId);
    const evidence = key(change.evidence);
    const matches = timelineSteps.map((step, index) => ({ step, index })).filter(({step,index}) => {
      if (claimed.has(index) || !compatibleIntents.has(clean(step.intent))) return false;
      if (actorId && clean(step.actorId) && key(step.actorId) !== actorId) return false;
      if (targetId && clean(step.targetId) && key(step.targetId) !== targetId) return false;
      if (evidence && clean(step.evidence) && key(step.evidence) !== evidence) return false;
      return true;
    });
    if (matches.length === 1) return matches[0];
    // Backward compatibility: older scenes have no actor/target/evidence keys.
    // Keep their historical stable order, but never use this fallback when
    // any grounding identity was authored or when evidence is ambiguous.
    if (!actorId && !targetId && !evidence) {
      return timelineSteps.map((step, index) => ({ step, index }))
        .find(({step,index}) => !claimed.has(index) && compatibleIntents.has(clean(step.intent))) || null;
    }
    return null;
  };
  const claimedSteps = new Set();
  const matchedStepByChange = new Map();
  for (const change of changes) {
    const intent = clean(change?.actionIntent);
    if (!intent) continue;
    const compatible = intent === 'drop' ? new Set(['drop', 'drop_weapon', 'throw']) : new Set([intent]);
    const match = matchActionStep(change, compatible, claimedSteps);
    if (match) {
      claimedSteps.add(match.index);
      matchedStepByChange.set(change, match.step);
    }
  }
  const byProp = new Map();
  for (const change of changes) {
    if (!change || change.entityType !== 'prop' || change.property !== 'holder') continue;
    const entityId = clean(change.entityId);
    if (!entityId) continue;
    const propKey = key(entityId);
    if (!byProp.has(propKey)) byProp.set(propKey, []);
    byProp.get(propKey).push(change);
  }

  const ground = { x: 0.68, y: 0.79, rotation: 0 };
  const holderPoint = (holderId, loosePosition = null) => {
    if (holderId == null || !clean(holderId)) return normalizedPoint(loosePosition) || ground;
    const actorId = clean(holderId);
    const actor = layers.find(layer => key(layer?.characterId) === key(actorId));
    const actorX = Number.isFinite(actor?.x) ? actor.x : 0.5;
    const actorY = Number.isFinite(actor?.y) ? actor.y : 0.68;
    const rigAnchor = resolveCharacterPropAnchor(actorId, runtime.characterRigs, runtime.rigPoses);
    return rigAnchor
      ? { x: rigAnchor.x, y: rigAnchor.y, rotation: rigAnchor.rotation }
      : { x: clamp(actorX + (actor?.flipX ? -0.12 : 0.12), 0.04, 0.96),
          y: clamp(actorY - 0.08, 0.08, 0.9), rotation: 0 };
  };

  const holderPlans = [...byProp.values()].map(history => {
    const entityId = clean(history[0].entityId);
    const interval = (phaseEnd - phaseStart) / Math.max(1, history.length);
    let holder = history[0].previousValue ?? null;
    let from = holderPoint(holder, history[0].position);
    let to = from;
    let held = holder != null;
    let activeEvidence = clean(history[0].evidence);
    let transitionProgress = 1;
    let activeIndex = -1;

    for (let index = 0; index < history.length; index += 1) {
      const change = history[index];
      const matchedStep = matchedStepByChange.get(change);
      const start = matchedStep ? matchedStep.start : phaseStart + interval * index;
      const end = matchedStep ? matchedStep.end : start + interval;
      const nextHolder = change.value ?? null;
      if (p < start) break;
      from = holderPoint(holder, change.position);
      to = holderPoint(nextHolder, change.position);
      activeEvidence = clean(change.evidence);
      activeIndex = index;
      if (p <= end) {
        transitionProgress = clamp((p - start) / Math.max(0.000001, end - start), 0, 1);
        const eased = transitionProgress * transitionProgress * (3 - 2 * transitionProgress);
        const x = from.x + (to.x - from.x) * eased;
        const y = from.y + (to.y - from.y) * eased;
        const rotation = (from.rotation || 0) + ((to.rotation || 0) - (from.rotation || 0)) * eased;
        return {
          id: entityId, kind: propKind(entityId), x, y, rotation,
          held: transitionProgress >= 0.5 ? nextHolder != null : holder != null,
          visible: true, scale: 1, evidence: activeEvidence,
          transitionIndex: index, transitionProgress
        };
      }
      holder = nextHolder;
      held = holder != null;
    }

    const finalPositionChange = history[activeIndex >= 0 ? activeIndex : 0];
    const point = holderPoint(holder, finalPositionChange?.position);
    return {
      id: entityId, kind: propKind(entityId), x: point.x, y: point.y,
      rotation: point.rotation || 0, held, visible: true, scale: 1,
      evidence: activeEvidence, transitionIndex: activeIndex,
      transitionProgress: 1
    };
  });

  // Explicit position changes are rendered only when both endpoints are known.
  // A missing start position stays static rather than inventing a trajectory.
  const positionByProp = new Map();
  for (const change of changes) {
    if (!change || change.entityType !== 'prop' || change.property !== 'position') continue;
    const entityId = clean(change.entityId);
    if (!entityId || !normalizedPoint(change.position)) continue;
    const propKey = key(entityId);
    if (!positionByProp.has(propKey)) positionByProp.set(propKey, []);
    positionByProp.get(propKey).push(change);
  }

  const claimedPositionSteps = new Set();
  for (const [propKey, history] of positionByProp) {
    const existing = holderPlans.find(item => key(item.id) === propKey);
    // A held prop follows its holder anchor; world-space motion cannot detach it.
    if (existing?.held) continue;
    let current = null;
    let active = null;
    for (let index = 0; index < history.length; index += 1) {
      const change = history[index];
      const from = normalizedPoint(change.previousPosition) || current;
      const to = normalizedPoint(change.position);
      if (!to) continue;
      const actionIntent = clean(change.actionIntent);
      const match = actionIntent
        ? matchActionStep(change, new Set([actionIntent]), claimedPositionSteps)
        : null;
      const matchedStep = match?.step || null;
      if (match) claimedPositionSteps.add(match.index);
      const start = matchedStep ? matchedStep.start : phaseStart + (phaseEnd - phaseStart) * index / history.length;
      const end = matchedStep ? matchedStep.end : phaseStart + (phaseEnd - phaseStart) * (index + 1) / history.length;
      if (!from) {
        current = to;
        active = { change, index, progress: 1 };
        continue;
      }
      if (p < start) {
        current = from;
        active = { change, index, progress: 0 };
        break;
      }
      if (p <= end) {
        const progress = clamp((p - start) / Math.max(0.000001, end - start), 0, 1);
        const eased = progress * progress * (3 - 2 * progress);
        current = { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
        active = { change, index, progress };
        break;
      }
      current = to;
      active = { change, index, progress: 1 };
    }
    if (!current) continue;
    const plan = {
      ...(existing || {}),
      id: clean(history[0].entityId),
      kind: propKind(history[0].entityId),
      x: current.x,
      y: current.y,
      rotation: existing?.rotation || 0,
      held: existing?.held === true,
      visible: true,
      scale: existing?.scale || 1,
      evidence: clean(active?.change?.evidence),
      transitionIndex: active?.index ?? -1,
      transitionProgress: active?.progress ?? 1
    };
    if (existing) Object.assign(existing, plan);
    else holderPlans.push(plan);
  }
  const physicsModel = buildScenePhysicsModel([scene]);
  const physicsVisuals = buildGroundedPhysicsVisualPlan(scene, physicsModel, p);
  for (const visual of physicsVisuals) {
    const existing = holderPlans.find(item => key(item.id) === key(visual.id));
    // A prop attached to a character remains controlled by its holder anchor.
    if (existing?.held) continue;
    const plan = {
      ...(existing || {}),
      id: visual.id,
      kind: propKind(visual.id),
      x: visual.x,
      y: visual.y,
      rotation: existing?.rotation || 0,
      held: false,
      visible: true,
      scale: existing?.scale || 1,
      evidence: visual.evidence,
      physicsEventId: visual.eventId,
      physicsEventType: visual.eventType,
      transitionProgress: visual.progress
    };
    if (existing) Object.assign(existing, plan);
    else holderPlans.push(plan);
  }
  return holderPlans;
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

function drawProp(context, prop, x, y, time) {
  const bob = prop.held ? Math.sin(time * 4) * 0.008 : 0;
  context.save();
  context.translate(x, y + bob);
  context.rotate(Number.isFinite(prop.rotation) ? prop.rotation : 0);
  context.lineWidth = 2.5;
  context.lineJoin = 'round';
  if (prop.kind === 'star') {
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
  for (const prop of plan) drawProp(context, prop, prop.x * width, prop.y * height, Number.isFinite(time) ? time : 0);
  return { drawn: plan.length, skipped: 0, props: plan };
}

import { applyCharacterRigPose, validateCharacterRig } from './character-rig.js';

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
    .flatMap(phase => Array.isArray(phase?.steps) ? phase.steps : [])
    .filter(step => Number.isFinite(step?.start) && Number.isFinite(step?.end)
      && step.start >= 0 && step.start < step.end && step.end <= 1);
  const claimedSteps = new Set();
  const matchedStepByChange = new Map();
  for (const change of changes) {
    const intent = clean(change?.actionIntent);
    if (!intent) continue;
    const compatible = intent === 'drop' ? new Set(['drop', 'drop_weapon', 'throw']) : new Set([intent]);
    const stepIndex = timelineSteps.findIndex((step, index) =>
      !claimedSteps.has(index) && compatible.has(clean(step.intent))
    );
    if (stepIndex >= 0) {
      claimedSteps.add(stepIndex);
      matchedStepByChange.set(change, timelineSteps[stepIndex]);
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

  return [...byProp.values()].map(history => {
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

    const point = holderPoint(holder, history[activeIndex]?.position);
    return {
      id: entityId, kind: propKind(entityId), x: point.x, y: point.y,
      rotation: point.rotation || 0, held, visible: true, scale: 1,
      evidence: activeEvidence, transitionIndex: activeIndex,
      transitionProgress: 1
    };
  });
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

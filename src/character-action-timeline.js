/**
 * Validates explicit, normalized action phases for a scene.
 * This checks timeline metadata only; it does not prove that rendered motion matches it.
 */
const PHASE_ORDER = ['preparation', 'action', 'reaction', 'result'];
const isRecord = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

function issue(code, phase, message) {
  return { code, phase: phase || null, severity: 'error', message };
}

export function normalizeCharacterActionTimeline(rawTimeline) {
  if (rawTimeline == null) return null;
  if (!isRecord(rawTimeline) || !Array.isArray(rawTimeline.phases)) {
    return { schemaVersion: isRecord(rawTimeline) ? rawTimeline.schemaVersion : null, phases: null };
  }
  return {
    schemaVersion: rawTimeline.schemaVersion,
    phases: rawTimeline.phases.slice(0, 9).map(phase => {
      if (!isRecord(phase)) return null;
      const start = Number(phase.start);
      const end = Number(phase.end);
      return {
        phase: clean(phase.phase, 24),
        start: Number.isFinite(start) ? start : null,
        end: Number.isFinite(end) ? end : null,
        actorId: clean(phase.actorId, 120),
        targetId: clean(phase.targetId, 120) || null,
        description: clean(phase.description, 700),
        evidence: clean(phase.evidence, 500)
      };
    })
  };
}

/**
 * Phases use normalized scene time (0..1). Missing timelines are reported as
 * unavailable, not invalid, so older storyboards remain compatible.
 */
export function validateCharacterActionTimeline(scene = {}) {
  let raw;
  try { raw = scene?.actionTimeline; } catch {
    return { status: 'invalid', passed: false, issues: [issue('timeline-unreadable', null, 'Action timeline could not be read safely.')] };
  }
  if (raw == null) return { status: 'not-provided', passed: null, issues: [] };

  const timeline = normalizeCharacterActionTimeline(raw);
  if (!timeline || raw.schemaVersion !== 1 || !Array.isArray(raw.phases)
      || raw.phases.length === 0 || raw.phases.length > 8) {
    return { status: 'invalid', passed: false, issues: [issue('timeline-shape-invalid', null, 'Provide schemaVersion 1 and between one and eight action phases.')] };
  }

  const issues = [];
  const cast = new Set((Array.isArray(scene.characters) ? scene.characters : [])
    .map(value => clean(value, 120).toLocaleLowerCase()).filter(Boolean));
  const evidenceSources = [scene.storyDetail, ...(Array.isArray(scene.sourceEvents) ? scene.sourceEvents : [])]
    .map(value => clean(value, 2_000)).filter(Boolean);
  const seen = new Set();
  let previousRank = -1;
  let previousStart = -1;
  const byPhase = new Map();

  raw.phases.forEach((phase, index) => {
    const normalized = timeline.phases[index];
    if (!normalized) {
      issues.push(issue('phase-shape-invalid', null, 'Every phase must be an object.'));
      return;
    }
    const name = normalized.phase;
    const rank = PHASE_ORDER.indexOf(name);
    if (rank < 0) issues.push(issue('phase-unknown', name, 'Phase must be preparation, action, reaction, or result.'));
    else {
      if (seen.has(name)) issues.push(issue('phase-duplicate', name, 'A phase may appear only once.'));
      if (rank < previousRank) issues.push(issue('phase-order-invalid', name, 'Phases must follow preparation, action, reaction, result order.'));
      seen.add(name);
      previousRank = rank;
      byPhase.set(name, normalized);
    }

    if (normalized.start === null || normalized.end === null
        || normalized.start < 0 || normalized.end > 1
        || normalized.start >= normalized.end) {
      issues.push(issue('phase-timing-invalid', name, 'Phase timing must satisfy 0 <= start < end <= 1.'));
    } else {
      if (normalized.start < previousStart) issues.push(issue('phase-timing-order-invalid', name, 'Phase start times must be nondecreasing.'));
      previousStart = normalized.start;
    }

    if (!normalized.description) issues.push(issue('phase-description-missing', name, 'Every phase needs a concrete visible description.'));
    if (!normalized.actorId) issues.push(issue('phase-actor-missing', name, 'Every phase needs an acting character ID.'));
    else if (Array.isArray(scene.characters) && !cast.has(normalized.actorId.toLocaleLowerCase())) {
      issues.push(issue('phase-actor-not-in-cast', name, 'The phase actor must belong to this scene cast.'));
    }
    if (!normalized.evidence || !evidenceSources.some(source => source.includes(normalized.evidence))) {
      issues.push(issue('phase-evidence-ungrounded', name, 'Phase evidence must exactly match locked source-story evidence.'));
    }
  });

  const action = byPhase.get('action');
  const preparation = byPhase.get('preparation');
  const reaction = byPhase.get('reaction');
  const result = byPhase.get('result');
  if (!action) issues.push(issue('action-phase-required', 'action', 'A supplied action timeline must include its central action phase.'));
  if (preparation && action && preparation.end > action.start) {
    issues.push(issue('preparation-overlaps-action', 'preparation', 'Preparation must finish before the central action starts.'));
  }
  if (reaction && action && reaction.start < action.end) {
    issues.push(issue('reaction-before-action-complete', 'reaction', 'Reaction must begin after the central action finishes.'));
  }
  const resultFloor = Math.max(action?.end ?? 0, reaction?.end ?? 0);
  if (result && result.start < resultFloor) {
    issues.push(issue('result-before-reaction-complete', 'result', 'Result must begin after the action and any supplied reaction finish.'));
  }

  return {
    status: issues.length ? 'invalid' : 'valid',
    passed: issues.length === 0,
    phaseCount: raw.phases.length,
    issues
  };
}

export function evaluateCharacterActionTimelines(scenes = []) {
  const list = Array.isArray(scenes) ? scenes : [];
  const supplied = list.filter(scene => {
    try { return scene?.actionTimeline != null; } catch { return true; }
  });
  if (!supplied.length) {
    return { schemaVersion: 1, evaluatedSceneCount: 0, suppliedSceneCount: 0, coverage: null, integrity: null, passed: null, issues: [] };
  }

  const issues = [];
  let valid = 0;
  for (const scene of supplied) {
    const report = validateCharacterActionTimeline(scene);
    if (report.passed) valid += 1;
    for (const entry of report.issues) {
      issues.push({ sceneId: clean(scene?.id, 120) || null, ...entry });
    }
  }
  return {
    schemaVersion: 1,
    evaluatedSceneCount: list.length,
    suppliedSceneCount: supplied.length,
    coverage: list.length ? Math.round((supplied.length / list.length) * 100) : null,
    integrity: Math.round((valid / supplied.length) * 100),
    passed: issues.length === 0,
    issues,
    limitations: [
      'This validates written phase order, timing, cast IDs, and locked source-story evidence only.',
      'It does not inspect rendered frames or prove that character animation follows the timeline.'
    ]
  };
}

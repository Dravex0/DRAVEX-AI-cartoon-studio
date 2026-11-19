/**
 * Editorial decision layer over the source-grounded semantic shot plan.
 * It describes pacing, cut intent and continuity risks; it does not synthesize
 * footage, music, sound effects or facts that are absent from the source.
 */
const clean = (value, max = 300) => String(value ?? '').trim().slice(0, max);
const record = value => value && typeof value === 'object' && !Array.isArray(value);

function explicitTransition(value) {
  const text = clean(value, 100).toLocaleLowerCase();
  if (/dissolve|cross.?fade|наплыв|перетік/u.test(text)) return 'dissolve';
  if (/fade.?to.?black|fade.?out|затемнен|згас/u.test(text)) return 'fade';
  if (/match.?cut|match.?action|по движению|за рухом/u.test(text)) return 'match_cut';
  if (/whip.?pan|резк.{0,8}панорам|швидк.{0,8}панорам/u.test(text)) return 'whip_pan';
  if (/jump.?cut|скачок монтажа|стрибок монтажу/u.test(text)) return 'jump_cut';
  if (/cut|склейк|монтажн.{0,8}стык/u.test(text)) return 'cut';
  return null;
}

function paceFor(duration) {
  if (duration < 1.5) return 'very_fast';
  if (duration < 2.5) return 'fast';
  if (duration <= 5) return 'steady';
  if (duration <= 8) return 'slow';
  return 'very_slow';
}

function locationOf(shot) {
  return clean(shot?.continuity?.location, 300) || null;
}

function entityStateMap(shot) {
  const result = new Map();
  for (const change of Array.isArray(shot?.continuity?.stateChanges) ? shot.continuity.stateChanges : []) {
    if (!record(change) || !change.entityId || !change.property) continue;
    result.set(`${change.entityId}:${change.property}`, change.value);
  }
  return result;
}

/** Create editorial decisions and continuity diagnostics from a semantic editing plan. */
export function buildEditDecisionPlan(editingPlan, scenes = [], worldModel = null) {
  const shots = Array.isArray(editingPlan?.shots) ? editingPlan.shots.filter(record) : [];
  const sceneMap = new Map((Array.isArray(scenes) ? scenes : [])
    .filter(record).map((scene, index) => [clean(scene.id, 120) || `scene_${index + 1}`, scene]));
  const decisions = [];
  const issues = [];
  const pacing = shots.map(shot => ({
    shotId: shot.id,
    durationSeconds: Number(shot.durationSeconds) || 0,
    pace: paceFor(Number(shot.durationSeconds) || 0),
    role: shot.role || 'unknown'
  }));

  for (let index = 1; index < shots.length; index += 1) {
    const previous = shots[index - 1];
    const current = shots[index];
    const sameScene = previous.sceneId === current.sceneId;
    const sourceScene = sceneMap.get(current.sceneId);
    // Only an authored scene transition is authoritative. The semantic plan's
    // default cut metadata must not override same-scene action continuity.
    const declaredTransition = explicitTransition(sourceScene?.transition);
    const previousLocation = locationOf(previous);
    const currentLocation = locationOf(current);
    const locationChanged = Boolean(previousLocation && currentLocation && previousLocation !== currentLocation);
    const previousStates = entityStateMap(previous);
    const currentStates = entityStateMap(current);
    const stateDisagreements = [];
    for (const [key, value] of previousStates) {
      if (currentStates.has(key) && currentStates.get(key) !== value) {
        stateDisagreements.push({ entityProperty: key, previousValue: value, nextValue: currentStates.get(key) });
      }
    }
    if (stateDisagreements.length) {
      issues.push({ code: 'state-change-needs-grounded-transition', severity: 'warning',
        fromShotId: previous.id, toShotId: current.id, details: stateDisagreements });
    }
    const type = sameScene ? (declaredTransition || 'continuous_action') : (declaredTransition || 'cut');
    decisions.push({
      fromShotId: previous.id,
      toShotId: current.id,
      type,
      reason: sameScene
        ? 'Adjacent phases of the same source scene; preserve spatial and action continuity.'
        : locationChanged
          ? 'Source identifies a location change between scenes.'
          : 'New source scene; preserve chronology and do not imply an unrecorded event.',
      locationChanged,
      preserve: {
        participants: [...new Set([
          ...(previous.continuity?.participantIds || []),
          ...(current.continuity?.participantIds || [])
        ])],
        objectStates: [...currentStates.entries()].map(([entityProperty, value]) => ({ entityProperty, value }))
      },
      pacingChange: pacing[index - 1].pace !== pacing[index].pace
    });
  }

  for (const item of pacing) {
    if (item.durationSeconds <= 0) {
      issues.push({ code: 'non-positive-shot-duration', severity: 'error', shotId: item.shotId });
    }
  }
  if (shots.length > 1 && shots.every(shot => !shot.camera || shot.camera.scale === 'unspecified')) {
    issues.push({ code: 'camera-coverage-unspecified', severity: 'warning' });
  }
  const worldConflicts = worldModel?.validation?.stateContinuityConflicts;
  for (const conflict of Array.isArray(worldConflicts) ? worldConflicts : []) {
    issues.push({ code: 'world-state-continuity-conflict', severity: 'warning', details: conflict });
  }

  const soundtrack = (Array.isArray(scenes) ? scenes : []).flatMap(scene => {
    if (!record(scene)) return [];
    const cues = Array.isArray(scene.audioCues) ? scene.audioCues : [];
    return cues.filter(record).map(cue => ({
      sceneId: clean(scene.id, 120),
      type: clean(cue.type, 60) || 'unspecified',
      startSeconds: Number.isFinite(Number(cue.startSeconds)) ? Number(cue.startSeconds) : null,
      endSeconds: Number.isFinite(Number(cue.endSeconds)) ? Number(cue.endSeconds) : null,
      source: clean(cue.description || cue.source, 300)
    }));
  });

  return {
    schemaVersion: 1,
    shotCount: shots.length,
    cuts: decisions,
    pacing,
    soundtrack,
    validation: {
      passed: !issues.some(issue => issue.severity === 'error'),
      issues
    },
    constraints: [
      'Pacing labels are descriptive thresholds, not an automatic quality score.',
      'A transition is inferred only from an explicit source transition; otherwise scene boundaries use a cut and same-scene phases remain continuous.',
      'Soundtrack cues are copied only from explicit scene audioCues.',
      'Conflicting entity states are reported, never silently reconciled.'
    ]
  };
}

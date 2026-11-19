/**
 * Source-grounded editing plan for DRAVEX.
 * Converts explicit scene timing, actions, camera directions and world facts into
 * an ordered shot list. It does not invent new story beats or physical events.
 */
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const finite = value => Number.isFinite(Number(value));

function classifyCamera(value) {
  const text = clean(value, 1000).toLocaleLowerCase();
  let scale = 'unspecified';
  if (/extreme close|экстремальн.{0,12}крупн|надзвичайно крупн|primer[ií]simo plano/u.test(text)) scale = 'extreme_close_up';
  else if (/close.?up|крупн.{0,8}план|крупний план|primer plano/u.test(text)) scale = 'close_up';
  else if (/medium|средн.{0,8}план|середн.{0,8}план|plano medio/u.test(text)) scale = 'medium';
  else if (/wide|общ.{0,8}план|загальн.{0,8}план|plano general/u.test(text)) scale = 'wide';
  else if (/establishing|установочн|встановлювальн/u.test(text)) scale = 'establishing';
  let angle = 'unspecified';
  if (/low angle|снизу|знизу|нижн.{0,8}ракурс/u.test(text)) angle = 'low';
  else if (/high angle|сверху|зверху|верхн.{0,8}ракурс/u.test(text)) angle = 'high';
  else if (/eye.?level|на уровне глаз|на рівні очей/u.test(text)) angle = 'eye_level';
  let movement = 'unspecified';
  if (/tracking|следящ|супроводж|follow shot/u.test(text)) movement = 'tracking';
  else if (/dolly|въезд|наезд|від'їзд|наближен/u.test(text)) movement = 'dolly';
  else if (/pan|панорам/u.test(text)) movement = 'pan';
  else if (/tilt|наклон камер|нахил камер/u.test(text)) movement = 'tilt';
  else if (/handheld|ручн.{0,8}камер|з рук/u.test(text)) movement = 'handheld';
  else if (/static|locked.?off|неподвижн|статичн/u.test(text)) movement = 'static';
  return { scale, angle, movement, source: clean(value, 1000) };
}

function phaseRole(phase) {
  const value = clean(phase, 40).toLocaleLowerCase();
  if (['preparation', 'setup', 'establishing'].includes(value)) return 'setup';
  if (['reaction', 'response'].includes(value)) return 'reaction';
  if (['result', 'aftermath', 'outcome'].includes(value)) return 'result';
  if (['action', 'interaction'].includes(value)) return 'action';
  return 'documented_phase';
}

function sceneContinuityFacts(scene, worldModel) {
  const event = worldModel?.events?.find(item => item.sceneId === scene.id);
  const participantIds = Array.isArray(event?.participants)
    ? event.participants.filter(Boolean) : (Array.isArray(scene.characters) ? scene.characters : []);
  const relations = (Array.isArray(worldModel?.relations) ? worldModel.relations : [])
    .filter(item => item.sceneId === scene.id)
    .map(item => ({ type: item.type, from: item.from, to: item.to, action: item.action || null, property: item.property || null }));
  const stateChanges = (Array.isArray(scene.stateChanges) ? scene.stateChanges : [])
    .filter(record).map(change => ({
      entityId: clean(change.entityId, 160),
      property: clean(change.property, 60),
      previousValue: change.previousValue ?? null,
      value: change.value ?? null
    })).filter(change => change.entityId && change.property);
  return {
    participantIds: [...new Set(participantIds.map(value => clean(value, 160)).filter(Boolean))],
    location: clean(scene.location || scene.environmentDescription, 300) || null,
    relations,
    stateChanges
  };
}

/** Build deterministic shot timing and edit metadata from already-grounded scene facts. */
export function buildSemanticEditingPlan(scenes = [], worldModel = null) {
  const list = Array.isArray(scenes) ? scenes.filter(record) : [];
  const shots = [];
  const issues = [];
  let cursor = 0;
  let previousScene = null;
  list.forEach((scene, sceneIndex) => {
    const sceneId = clean(scene.id, 120) || `scene_${sceneIndex + 1}`;
    const duration = finite(scene.durationSeconds) && Number(scene.durationSeconds) > 0
      ? Math.min(120, Number(scene.durationSeconds)) : 3;
    const camera = classifyCamera(scene.camera);
    const phases = Array.isArray(scene.actionTimeline?.phases)
      ? scene.actionTimeline.phases.filter(record) : [];
    const validPhases = phases.length && phases.every(phase =>
      finite(phase.start) && finite(phase.end) && Number(phase.start) >= 0
      && Number(phase.end) <= 1 && Number(phase.end) > Number(phase.start))
      ? [...phases].sort((a, b) => Number(a.start) - Number(b.start)) : [];
    if (phases.length && !validPhases.length) {
      issues.push({ code: 'invalid-action-timeline', sceneId, severity: 'warning' });
    }
    const segments = validPhases.length ? validPhases.map(phase => ({
      role: phaseRole(phase.phase),
      start: Number(phase.start),
      end: Number(phase.end),
      action: clean(phase.description, 700),
      evidence: clean(phase.evidence, 500),
      actorId: clean(phase.actorId, 160) || null,
      targetId: clean(phase.targetId, 160) || null,
      phase: clean(phase.phase, 40) || 'action'
    })) : [{
      role: phases.length ? 'documented_phase' : (scene.visibleAction ? 'action' : 'establishing'),
      start: 0, end: 1,
      action: clean(scene.visibleAction || scene.storyDetail, 700),
      evidence: clean(scene.storyDetail, 500),
      actorId: null, targetId: null, phase: phases.length ? 'invalid_timeline_fallback' : 'scene'
    }];
    const facts = sceneContinuityFacts(scene, worldModel);
    for (const segment of segments) {
      const start = cursor + segment.start * duration;
      const end = cursor + segment.end * duration;
      shots.push({
        id: `shot_${shots.length + 1}`,
        sceneId,
        sceneOrder: sceneIndex + 1,
        shotOrder: shots.length + 1,
        role: segment.role,
        startSeconds: Number(start.toFixed(3)),
        endSeconds: Number(end.toFixed(3)),
        durationSeconds: Number((end - start).toFixed(3)),
        camera,
        action: segment.action,
        evidence: segment.evidence,
        actorId: segment.actorId,
        targetId: segment.targetId,
        continuity: facts,
        cut: shots.length === 0 ? { type: 'opening', reason: 'first shot' } : {
          type: clean(scene.transition, 80) || 'cut',
          reason: previousScene?.location && scene.location && previousScene.location !== scene.location
            ? 'source-grounded location change'
            : 'ordered scene boundary; preserve story chronology'
        }
      });
    }
    cursor += duration;
    previousScene = scene;
  });

  for (let index = 1; index < shots.length; index += 1) {
    if (shots[index].startSeconds < shots[index - 1].startSeconds) {
      issues.push({ code: 'shot-order-regression', shotId: shots[index].id, severity: 'error' });
    }
  }
  return {
    schemaVersion: 1,
    totalDurationSeconds: Number(cursor.toFixed(3)),
    shotCount: shots.length,
    shots,
    validation: {
      passed: !issues.some(issue => issue.severity === 'error'),
      issues
    },
    constraints: [
      'Shot order follows source scene and action-timeline order.',
      'Shot timing is derived only from explicit scene duration and normalized action phases.',
      'Camera classifications are descriptive readings of supplied camera text, not generated footage.',
      'Cuts never create new characters, objects, actions, reactions, or state changes.',
      'Continuity facts retain source-grounded participants, locations, directed relations, and object-state changes.'
    ]
  };
}

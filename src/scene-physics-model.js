/**
 * Conservative, source-grounded physics layer for DRAVEX scenes.
 *
 * This module does not simulate arbitrary prose. It accepts explicit structured
 * physicsEvents and derives quantities only when all required measurements exist.
 * Unknown mass, gravity, contact, and velocity remain unknown rather than guessed.
 */
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const TYPES = new Set(['collision', 'fall', 'support', 'motion', 'contact', 'transfer']);
const AXES = ['x', 'y', 'z'];

function vector(value) {
  if (!isRecord(value) || !AXES.every(axis => finite(value[axis]))) return null;
  return { x: value.x, y: value.y, z: value.z };
}

function sourceContains(scene, evidence) {
  if (!evidence) return false;
  const text = [scene.storyDetail, scene.visibleAction]
    .filter(value => typeof value === 'string').join('\n');
  if (text.includes(evidence)) return true;
  return (Array.isArray(scene.sourceEvents) ? scene.sourceEvents : []).some(item => {
    if (typeof item === 'string') return item.includes(evidence);
    return isRecord(item) && ['evidence', 'text', 'description']
      .some(key => typeof item[key] === 'string' && item[key].includes(evidence));
  });
}

function deriveMotion(event) {
  const start = vector(event.startPosition);
  const end = vector(event.endPosition);
  const duration = event.durationSeconds;
  if (!start || !end || !finite(duration) || duration <= 0) return null;
  return {
    displacementMeters: {
      x: Number((end.x - start.x).toFixed(6)),
      y: Number((end.y - start.y).toFixed(6)),
      z: Number((end.z - start.z).toFixed(6))
    },
    averageVelocityMps: {
      x: Number(((end.x - start.x) / duration).toFixed(6)),
      y: Number(((end.y - start.y) / duration).toFixed(6)),
      z: Number(((end.z - start.z) / duration).toFixed(6))
    },
    durationSeconds: duration
  };
}

function validateEvent(event, grounded, sceneId) {
  const issues = [];
  if (!TYPES.has(event.type)) issues.push({ code: 'unsupported-physics-event', severity: 'warning' });
  if (!event.entityId) issues.push({ code: 'physics-event-missing-entity', severity: 'warning' });
  if (!grounded) issues.push({ code: 'physics-event-source-unverified', severity: 'warning' });
  if (event.type === 'collision' && !event.otherEntityId) {
    issues.push({ code: 'collision-missing-other-body', severity: 'warning' });
  }
  if (event.type === 'support' && !event.supportEntityId) {
    issues.push({ code: 'support-missing-surface', severity: 'warning' });
  }
  if (event.type === 'fall' && !vector(event.startPosition) && !vector(event.endPosition)) {
    issues.push({ code: 'fall-without-measured-position', severity: 'warning' });
  }
  return issues.map(issue => ({ ...issue, sceneId, eventId: event.id }));
}

/** Build a cautious physics model from explicit scene physics metadata. */
export function buildScenePhysicsModel(scenes = [], worldModel = null) {
  const list = Array.isArray(scenes) ? scenes.filter(isRecord) : [];
  const events = [];
  const issues = [];
  const environments = [];
  let derivedMotionCount = 0;

  list.forEach((scene, sceneIndex) => {
    const sceneId = clean(scene.id, 120) || `scene_${sceneIndex + 1}`;
    const environment = isRecord(scene.physics) ? scene.physics : {};
    const gravityMps2 = finite(environment.gravityMps2) && environment.gravityMps2 >= 0
      ? environment.gravityMps2 : null;
    if (gravityMps2 !== null) environments.push({ sceneId, gravityMps2,
      gravitySource: clean(environment.gravitySource, 300) || null });

    const sourceEvents = Array.isArray(scene.physicsEvents) ? scene.physicsEvents : [];
    sourceEvents.forEach((raw, eventIndex) => {
      if (!isRecord(raw)) {
        issues.push({ code: 'malformed-physics-event', severity: 'warning', sceneId, eventIndex });
        return;
      }
      const id = clean(raw.id, 120) || `${sceneId}_physics_${eventIndex + 1}`;
      const type = clean(raw.type, 40).toLocaleLowerCase();
      const evidence = clean(raw.evidence, 500);
      const grounded = sourceContains(scene, evidence);
      const normalized = {
        id, sceneId, type,
        entityId: clean(raw.entityId, 160) || null,
        otherEntityId: clean(raw.otherEntityId, 160) || null,
        supportEntityId: clean(raw.supportEntityId, 160) || null,
        evidence: evidence || null,
        grounded,
        contact: raw.contact === true,
        startPosition: vector(raw.startPosition),
        endPosition: vector(raw.endPosition),
        durationSeconds: finite(raw.durationSeconds) && raw.durationSeconds > 0
          ? raw.durationSeconds : null,
        massKg: finite(raw.massKg) && raw.massKg > 0 ? raw.massKg : null,
        initialVelocityMps: vector(raw.initialVelocityMps),
        finalVelocityMps: vector(raw.finalVelocityMps),
        derivedMotion: null,
        derivedImpulseNs: null
      };

      if (grounded && TYPES.has(type)) {
        normalized.derivedMotion = deriveMotion(raw);
        if (normalized.derivedMotion) derivedMotionCount += 1;

        // Impulse is derived only for a single body with explicit mass and both
        // measured velocity vectors. This is not a full multi-body collision solve.
        if (type === 'collision' && normalized.massKg
            && normalized.initialVelocityMps && normalized.finalVelocityMps) {
          normalized.derivedImpulseNs = Object.fromEntries(AXES.map(axis => [
            axis,
            Number((normalized.massKg
              * (normalized.finalVelocityMps[axis] - normalized.initialVelocityMps[axis])).toFixed(6))
          ]));
        }
      }

      const eventIssues = validateEvent(normalized, grounded, sceneId);
      issues.push(...eventIssues);
      events.push(normalized);
    });
  });

  const knownEntities = new Set((Array.isArray(worldModel?.entities) ? worldModel.entities : [])
    .filter(isRecord).map(entity => clean(entity.id, 160)).filter(Boolean));

  for (const event of events) {
    if (event.grounded && event.entityId && knownEntities.size && !knownEntities.has(event.entityId)) {
      issues.push({ code: 'physics-entity-not-in-world-model', severity: 'warning',
        sceneId: event.sceneId, eventId: event.id, entityId: event.entityId });
    }
    if (event.grounded && event.type === 'fall' && !environments.some(item => item.sceneId === event.sceneId)) {
      issues.push({ code: 'fall-gravity-unknown', severity: 'info',
        sceneId: event.sceneId, eventId: event.id });
    }
  }

  return {
    schemaVersion: 1,
    eventCount: events.length,
    groundedEventCount: events.filter(event => event.grounded).length,
    derivedMotionCount,
    environments,
    events,
    validation: {
      passed: !issues.some(issue => issue.severity === 'error'),
      issues
    },
    constraints: [
      'Only explicit structured physics events are modeled; prose is not silently converted into collisions or falls.',
      'Evidence must occur in the scene source text or source events before any physical quantity is derived.',
      'Gravity, mass, contact, position and velocity remain unknown unless explicitly supplied.',
      'Average velocity and impulse are arithmetic derivations from supplied measurements, not a full physics simulation.',
      'Unknown values are preserved as null and never replaced with plausible guesses.'
    ]
  };
}

/**
 * Source-grounded motion instructions for non-character world elements.
 * This enriches provider prompts only when the storyboard explicitly supplies
 * environment motion, prop interactions, or object state changes. It does not
 * claim that a video model obeyed those instructions.
 */
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const unique = values => [...new Set((Array.isArray(values) ? values : []).map(value => clean(value)).filter(Boolean))];

export function buildWorldMotionInstructions(scene = {}) {
  const environment = unique(scene.environmentMotion);
  const explicitInteractions = (Array.isArray(scene.interactions) ? scene.interactions : [])
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const actor = clean(item.actorId, 120);
      const target = clean(item.targetId, 120);
      const type = clean(item.type, 40);
      const evidence = clean(item.evidence, 500);
      return actor && target && type
        ? `Actor "${actor}" performs "${type}" with target "${target}" (source: ${evidence || 'explicit storyboard interaction'}).`
        : '';
    }).filter(Boolean);
  const propStates = Array.isArray(scene.propStates) ? scene.propStates : [];
  const stateSource = propStates.length ? propStates : (Array.isArray(scene.stateChanges) ? scene.stateChanges : []);
  const stateChanges = stateSource
    .filter(change => change && typeof change === 'object' && clean(change.entityType, 20) === 'prop')
    .map(change => {
      const object = clean(change.entityId, 120);
      const property = clean(change.property, 40);
      const value = change.value == null ? 'released / no longer held' : clean(change.value, 120);
      const actor = clean(change.actorId, 120);
      if (!object || !property) return '';
      // Retain the legacy wording for scenes that do not supply a persistent
      // prop snapshot; this keeps existing provider prompts stable.
      if (!propStates.length) {
        return `Prop "${object}" changes ${property} to "${value}"${actor ? ` through actor "${actor}"` : ''}.`;
      }
      const startValue = Object.prototype.hasOwnProperty.call(change, 'startValue')
        ? change.startValue == null ? 'not held / not yet established' : clean(change.startValue, 120)
        : change.previousValue == null ? 'not held / not yet established' : clean(change.previousValue, 120);
      const transition = startValue === value
        ? `remains ${property} "${value}"`
        : `changes ${property} from "${startValue}" to "${value}"`;
      return `Prop "${object}" ${transition}${actor ? ` through actor "${actor}"` : ''}.`;
    }).filter(Boolean);

  if (!environment.length && !explicitInteractions.length && !stateChanges.length) return '';

  return [
    'World and object motion contract (animate these explicit elements independently of the camera):',
    ...environment.map((cue, index) => `- Environment motion ${index + 1}: ${cue}`),
    ...explicitInteractions.map((cue, index) => `- Physical interaction ${index + 1}: ${cue}`),
    ...stateChanges.map((cue, index) => `- Prop state continuity ${index + 1}: ${cue}`),
    'Show cause and effect visibly: contact must occur before an object moves; objects must keep consistent size, orientation, and ownership; reactions must follow the action.',
    'Keep background motion spatially coherent and independent from camera motion. Do not animate an element unless it is listed above or explicitly required by the scene action.',
    'If a listed movement cannot be represented, preserve the element and report the limitation rather than replacing it with an unrelated motion.'
  ].join(String.fromCharCode(10));
}

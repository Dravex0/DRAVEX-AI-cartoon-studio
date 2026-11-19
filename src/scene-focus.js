const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const point = value => value && typeof value === 'object'
  && Number.isFinite(Number(value.x)) && Number.isFinite(Number(value.y))
  ? { x: Number(value.x), y: Number(value.y) }
  : null;

/**
 * Choose a camera focus that keeps the procedural protagonist visible.
 * When the shot targets a prop, center the frame between the actor and prop
 * instead of zooming onto the prop and pushing the actor toward the edge.
 */
export function resolveSceneFocus({
  fallbackCharacterVisible = false,
  actorPoint = null,
  propPoint = null,
  focusTarget = 'actor',
  viewportWidth = 1280,
  viewportHeight = 720,
  requestedOffsetY = 0
} = {}) {
  const width = Math.max(1, finite(viewportWidth, 1280));
  const height = Math.max(1, finite(viewportHeight, 720));
  const offsetY = finite(requestedOffsetY, 0);
  const actor = point(actorPoint);
  const prop = point(propPoint);

  if (!fallbackCharacterVisible || !actor) {
    return { x: width / 2, y: height * 0.65, offsetY };
  }

  if (focusTarget === 'prop' && prop) {
    return {
      x: (actor.x + prop.x) / 2,
      y: (actor.y + prop.y) / 2,
      offsetY: 0
    };
  }

  return { x: actor.x, y: actor.y, offsetY };
}

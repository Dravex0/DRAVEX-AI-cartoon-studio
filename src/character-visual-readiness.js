import { hasRenderableCharacterLayer, hasRenderableCharacterRig } from './demo-character-mode.js';

const cleanId = value => String(value ?? '').trim();
const uniqueIds = values => {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).map(cleanId).filter(value => {
    const key = value.toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Count scenes that cannot render every required cast member in local-canvas mode.
 * A scene background image or decoded video is not character evidence by itself.
 * A decoded clip suppresses the local procedural-actor renderer, so that scene still
 * needs a matching sprite or validated rig. Procedural actors count only when the
 * renderer will actually draw them (no decoded scene clip).
 */
export function countScenesMissingCharacterVisuals(scenes, {
  protagonistId = '',
  proceduralActors = false,
  hasSceneVideo = () => false
} = {}) {
  const protagonist = cleanId(protagonistId);
  const list = Array.isArray(scenes) ? scenes : [];
  return list.filter((scene, index) => {
    const cast = uniqueIds(scene?.characters);
    const requiredIds = cast.length ? cast : (protagonist ? [protagonist] : []);
    if (!requiredIds.length) return true;
    const sceneHasDecodedVideo = typeof hasSceneVideo === 'function'
      && hasSceneVideo(scene, index) === true;

    return requiredIds.some(characterId => {
      // The app draws procedural actors only when no decoded scene video is
      // available. Do not let a cached clip bypass this gate: it may be scenery.
      if (proceduralActors === true && !sceneHasDecodedVideo) return false;
      return !hasRenderableCharacterLayer(scene, characterId)
        && !hasRenderableCharacterRig(scene, characterId);
    });
  }).length;
}

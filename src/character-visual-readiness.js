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
 * A scene background image or cached video is not character evidence by itself.
 * A cached clip may decode during export and suppress the local procedural-actor
 * renderer, so require a matching sprite or validated rig whenever a clip is cached.
 * Procedural actors count only when no cached scene clip can suppress their renderer.
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
    const sceneHasVideo = typeof hasSceneVideo === 'function'
      && hasSceneVideo(scene, index) === true;

    return requiredIds.some(characterId => {
      // A cached video can become decoded during export. Treat it as a possible
      // renderer suppressor now, but never as proof that the required character exists.
      if (proceduralActors === true && !sceneHasVideo) return false;
      return !hasRenderableCharacterLayer(scene, characterId)
        && !hasRenderableCharacterRig(scene, characterId);
    });
  }).length;
}

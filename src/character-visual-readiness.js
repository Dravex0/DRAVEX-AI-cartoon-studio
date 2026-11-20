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
 * Scene backgrounds and cached videos are deliberately not character evidence:
 * either may contain only scenery. Only matching sprite layers, validated rigs,
 * and the explicitly enabled built-in protagonist fallback satisfy the cast.
 */
export function countScenesMissingCharacterVisuals(scenes, {
  protagonistId = '',
  proceduralFallback = false
} = {}) {
  const protagonist = cleanId(protagonistId);
  const list = Array.isArray(scenes) ? scenes : [];
  return list.filter((scene, index) => {
    const cast = uniqueIds(scene?.characters);
    const requiredIds = cast.length ? cast : (protagonist ? [protagonist] : []);
    if (!requiredIds.length) return false;
    return requiredIds.some(characterId => {
      const isProceduralProtagonist = proceduralFallback === true
        && protagonist
        && characterId.toLocaleLowerCase() === protagonist.toLocaleLowerCase();
      if (isProceduralProtagonist) return false;
      return !hasRenderableCharacterLayer(scene, characterId)
        && !hasRenderableCharacterRig(scene, characterId);
    });
  }).length;
}

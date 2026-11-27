import { normalizeSceneCast } from './scene-cast.js';

/**
 * Find storyboard scenes whose generated appearance can be affected by a Character Bible edit.
 * Legacy scenes without an explicit cast use the Character Bible fallback and are therefore included.
 */
export function findSceneIndexesUsingCharacterReference(scenes, characterId) {
  const target = String(characterId ?? '').trim().slice(0, 120).toLocaleLowerCase();
  if (!target || !Array.isArray(scenes)) return [];

  const indexes = [];
  scenes.forEach((scene, index) => {
    if (!scene || typeof scene !== 'object' || Array.isArray(scene)) return;
    if (!Array.isArray(scene.characters) && typeof scene.characters !== 'string') {
      indexes.push(index);
      return;
    }
    const cast = normalizeSceneCast(scene.characters);
    if (!cast.length && typeof scene.characters === 'string') {
      indexes.push(index);
      return;
    }
    if (cast.some(name => name.toLocaleLowerCase() === target)) indexes.push(index);
  });
  return indexes;
}

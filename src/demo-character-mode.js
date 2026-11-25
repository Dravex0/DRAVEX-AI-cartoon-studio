import { validateCharacterRig } from './character-rig.js';
import { normalizeCharacterLayers } from './scene-character-layers.js';

/** Return true only when the requested character has a visible, image-backed sprite layer. */
export function hasRenderableCharacterLayer(scene, characterId = '') {
  const target = String(characterId ?? '').trim().toLocaleLowerCase();
  if (!target) return false;
  return normalizeCharacterLayers(scene?.characterLayers).some(layer =>
    layer.visible && layer.opacity > 0 && layer.imageUrl
      && layer.characterId.toLocaleLowerCase() === target
  );
}

/** Return true only when a scene has a structurally valid, image-backed character rig. */
export function hasRenderableCharacterRig(sceneOrRigs, characterId = '') {
  const rigs = Array.isArray(sceneOrRigs)
    ? sceneOrRigs
    : Array.isArray(sceneOrRigs?.characterRigs) ? sceneOrRigs.characterRigs : [];
  const target = String(characterId ?? '').trim().toLocaleLowerCase();
  return rigs.some(input => {
    const report = validateCharacterRig(input);
    return report.passed && (!target || report.rig.characterId.toLocaleLowerCase() === target);
  });
}

/**
 * Procedural demo characters are intentionally disabled.
 * Missing character artwork must stay visibly missing rather than silently
 * substituting a hard-coded fox that does not follow the user's prompt.
 */
export function resolveProceduralDemoCharacter() {
  return false;
}

/** Never display a hard-coded demo character in place of prompt-derived artwork. */
export function shouldShowProceduralDemoCharacter() {
  return false;
}

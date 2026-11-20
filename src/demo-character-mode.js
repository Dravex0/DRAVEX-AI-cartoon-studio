import { validateCharacterRig } from './character-rig.js';
import { normalizeCharacterLayers } from './scene-character-layers.js';

const FOX_MARKERS = ['fox', 'лисиц', 'лисён', 'лисен', 'лисич'];
const DEFAULT_FALLBACK_NAMES = new Set(['Главный герой', 'Головний герой', 'Main character', 'Personaje principal']);
const NON_FOX_SPECIES_PATTERNS = [
  /\b(?:robot|android|human|person|man|woman|boy|girl|bird|rabbit|bunny|cat|dog|wolf|dragon|bear|deer|horse|mouse|fish|turtle)\b/iu,
  /(?:робот|андроид|андроїд|людин|человек|мужчин|женщин|мальчик|девочк|птиц|кролик|заяц|кот|кошк|собак|пёс|пес|волк|дракон|медвед|олень|лошад|мыш|рыб|черепах)/iu
];

function containsFoxMarker(value) {
  const source = String(value ?? '').toLocaleLowerCase();
  return FOX_MARKERS.some(marker => source.includes(marker));
}

function containsNonFoxSpeciesMarker(value) {
  const source = String(value ?? '').trim();
  return NON_FOX_SPECIES_PATTERNS.some(pattern => pattern.test(source));
}

/** Identify profiles that can be represented by the built-in procedural fox renderer. */
export function isProceduralFoxCharacter(profile = {}) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return false;
  const species = String(profile.species ?? '').trim();
  // An explicit species field is authoritative, even when the character's name is "Foxy".
  if (species) return containsFoxMarker(species);

  const appearance = [profile.visualDescription, profile.distinctiveFeatures]
    .map(value => String(value ?? '').trim())
    .filter(Boolean)
    .join(' ');
  // Do not replace a described robot, human, bird, or other non-fox with a fox
  // merely because its chosen name contains "Fox".
  if (containsNonFoxSpeciesMarker(appearance)) return false;
  if (containsFoxMarker(appearance)) return true;
  return containsFoxMarker(profile.characterId);
}

/** Preserve the same fallback decision when the deterministic or local-AI director rebuilds a plan. */
export function resolveProceduralDemoCharacter({ requestedCharacter = '', protagonistId = '', protagonistProfile = null } = {}) {
  const requested = String(requestedCharacter ?? '').trim();
  const id = String(protagonistId ?? protagonistProfile?.characterId ?? '').trim();
  const profile = protagonistProfile && typeof protagonistProfile === 'object' && !Array.isArray(protagonistProfile)
    ? protagonistProfile
    : { characterId: id };
  const hasExplicitAppearance = ['species', 'visualDescription', 'clothing', 'colors', 'distinctiveFeatures']
    .some(field => String(profile[field] ?? '').trim().length > 0);
  if (!requested && DEFAULT_FALLBACK_NAMES.has(id) && !hasExplicitAppearance) return true;
  return isProceduralFoxCharacter(profile);
}

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

/** Decide when the built-in procedural character should stand in for missing art. */
export function shouldShowProceduralDemoCharacter({ storyUsesFallback = false, hasCharacterLayers = false, hasCharacterRig = false } = {}) {
  return storyUsesFallback === true && hasCharacterLayers !== true && hasCharacterRig !== true;
}

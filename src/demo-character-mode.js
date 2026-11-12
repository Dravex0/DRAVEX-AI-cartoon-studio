const FOX_MARKERS = ['fox', 'лисиц', 'лисён', 'лисен', 'лисич'];
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

/** Decide when the built-in procedural character should stand in for missing art. */
export function shouldShowProceduralDemoCharacter({ storyUsesFallback = false, hasCharacterLayers = false } = {}) {
  return storyUsesFallback === true && hasCharacterLayers !== true;
}

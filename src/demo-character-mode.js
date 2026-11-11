const FOX_MARKERS = ['fox', 'лисиц', 'лисён', 'лисен', 'лисич'];

function containsFoxMarker(value) {
  const source = String(value ?? '').toLocaleLowerCase();
  return FOX_MARKERS.some(marker => source.includes(marker));
}

/** Identify profiles that can be represented by the built-in procedural fox renderer. */
export function isProceduralFoxCharacter(profile = {}) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return false;
  const species = String(profile.species ?? '').trim();
  if (species) return containsFoxMarker(species);
  const identity = [
    profile.characterId,
    profile.visualDescription,
    profile.distinctiveFeatures
  ].map(value => String(value ?? '').trim()).filter(Boolean).join(' ');
  return containsFoxMarker(identity);
}

/** Decide when the built-in procedural character should stand in for missing art. */
export function shouldShowProceduralDemoCharacter({ storyUsesFallback = false, hasCharacterLayers = false } = {}) {
  return storyUsesFallback === true && hasCharacterLayers !== true;
}

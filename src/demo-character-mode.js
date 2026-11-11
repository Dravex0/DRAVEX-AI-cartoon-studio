const FOX_IDENTITY = /\\bfox(?:y)?\\b|лис(?:[её]\\p{L}*|иц\\p{L}*|ичк\\p{L}*)/iu;

/** Identify profiles that can be represented by the built-in procedural fox renderer. */
export function isProceduralFoxCharacter(profile = {}) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return false;
  const species = String(profile.species ?? '').trim();
  if (species) return FOX_IDENTITY.test(species);
  const identity = [
    profile.characterId,
    profile.visualDescription,
    profile.distinctiveFeatures
  ].map(value => String(value ?? '').trim()).filter(Boolean).join(' ');
  return FOX_IDENTITY.test(identity);
}

/** Decide when the built-in procedural character should stand in for missing art. */
export function shouldShowProceduralDemoCharacter({ storyUsesFallback = false, hasCharacterLayers = false } = {}) {
  return storyUsesFallback === true && hasCharacterLayers !== true;
}

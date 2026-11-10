const clean = (value, max) => String(value ?? '').trim().slice(0, max);

export const CHARACTER_REFERENCE_LIMIT = 20;

/** Normalize a character profile before it is stored or added to a generation prompt. */
export function normalizeCharacterReference(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    characterId: clean(source.characterId, 120),
    referenceImageAssetId: clean(source.referenceImageAssetId, 100),
    visualDescription: clean(source.visualDescription, 1200),
    clothing: clean(source.clothing, 700),
    colors: clean(source.colors, 300),
    distinctiveFeatures: clean(source.distinctiveFeatures, 700),
    species: clean(source.species, 120),
    ageRange: clean(source.ageRange, 120),
    bodyShape: clean(source.bodyShape, 300),
    hair: clean(source.hair, 300),
    eyeColor: clean(source.eyeColor, 120),
    silhouette: clean(source.silhouette, 300),
    signatureAccessories: clean(source.signatureAccessories, 300)
  };
}

/** Create or update one profile without duplicating its stable character ID. */
export function upsertCharacterReference(references, input) {
  const next = Array.isArray(references)
    ? references.slice(0, CHARACTER_REFERENCE_LIMIT).map(normalizeCharacterReference)
    : [];
  const profile = normalizeCharacterReference(input);
  if (!profile.characterId) throw new TypeError('A character name or ID is required.');
  const index = next.findIndex(item => item.characterId.toLowerCase() === profile.characterId.toLowerCase());
  if (index >= 0) next[index] = profile;
  else {
    if (next.length >= CHARACTER_REFERENCE_LIMIT) throw new RangeError('Character reference limit reached.');
    next.push(profile);
  }
  return next;
}


/**
 * Merge profiles extracted from a story into the user's character library.
 * Existing entries win so a manually edited visual reference is never overwritten
 * by a weaker text extraction. IDs are de-duplicated case-insensitively.
 */
export function mergeCharacterReferences(existing = [], discovered = []) {
  const merged = [];
  const seen = new Set();
  const sources = [
    ...(Array.isArray(existing) ? existing : []),
    ...(Array.isArray(discovered) ? discovered : [])
  ];

  for (const source of sources) {
    const profile = normalizeCharacterReference(source);
    const key = profile.characterId.toLocaleLowerCase();
    if (!key || seen.has(key)) continue;
    if (merged.length >= CHARACTER_REFERENCE_LIMIT) break;
    seen.add(key);
    merged.push(profile);
  }

  return merged;
}


/**
 * Return only character profiles explicitly named in a scene cast.
 * An empty or unknown cast must never inherit unrelated character references.
 */
export function selectCharacterReferencesForScene(references = [], sceneCast = []) {
  const cast = (Array.isArray(sceneCast) ? sceneCast : String(sceneCast ?? '').split(','))
    .map(value => clean(value, 120).toLocaleLowerCase())
    .filter(Boolean);
  if (!cast.length) return [];
  const allowed = new Set(cast);
  const selected = [];
  const seen = new Set();
  for (const source of Array.isArray(references) ? references : []) {
    const profile = normalizeCharacterReference(source);
    const key = profile.characterId.toLocaleLowerCase();
    if (!key || !allowed.has(key) || seen.has(key)) continue;
    seen.add(key);
    selected.push(profile);
    if (selected.length >= 2) break;
  }
  return selected;
}

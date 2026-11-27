const cleanName = value => String(value ?? '').trim().slice(0, 180);

function normalizeReferenceImage(value, fallbackName) {
  const blob = value?.blob || value?.image || value;
  if (!blob || typeof blob.arrayBuffer !== 'function' || !Number.isFinite(Number(blob.size)) || Number(blob.size) <= 0) {
    return null;
  }
  const name = cleanName(value?.name || blob?.name || fallbackName) || fallbackName;
  return { name, blob };
}

/**
 * Prefer files explicitly selected for the current generation. Saved
 * Character Bible images fill remaining workflow slots; the provider reports
 * any overflow or unconfigured inputs instead of silently losing references.
 */
export function prioritizeCharacterReferenceImages(manualImages = [], profileImages = [], { manualSceneId = '', sceneId = '' } = {}) {
  const manual = Array.isArray(manualImages) ? manualImages : [];
  const profiles = Array.isArray(profileImages) ? profileImages : [];
  const manualBelongsToScene = cleanName(manualSceneId) !== ''
    && cleanName(manualSceneId) === cleanName(sceneId);
  return [
    ...(manualBelongsToScene
      ? manual.map((value, index) => normalizeReferenceImage(value, `manual-character-reference-${index + 1}.png`)).filter(Boolean)
      : []),
    ...profiles.map((value, index) => normalizeReferenceImage(value, `character-bible-reference-${index + 1}.png`)).filter(Boolean)
  ];
}

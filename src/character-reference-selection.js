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
 * Put files selected explicitly for the current ComfyUI run before saved
 * Character Bible images. Do not cap the list here: the provider knows which
 * workflow inputs are configured and reports references that cannot be used.
 */
export function prioritizeCharacterReferenceImages(manualImages = [], profileImages = []) {
  const manual = Array.isArray(manualImages) ? manualImages : [];
  const profiles = Array.isArray(profileImages) ? profileImages : [];
  return [
    ...manual.map((value, index) => normalizeReferenceImage(value, `manual-character-reference-${index + 1}.png`)).filter(Boolean),
    ...profiles.map((value, index) => normalizeReferenceImage(value, `character-bible-reference-${index + 1}.png`)).filter(Boolean)
  ];
}

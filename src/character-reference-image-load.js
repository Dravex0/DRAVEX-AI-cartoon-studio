import { normalizeSceneCast } from './scene-cast.js';
import { selectCharacterReferencesForScene } from './character-reference.js';

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const IMAGE_EXTENSIONS = Object.freeze({
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp'
});

export class CharacterReferenceImageLoadError extends Error {
  constructor(characterIds) {
    const names = [...new Set(characterIds.map(value => String(value || '').trim()).filter(Boolean))];
    super(
      'Saved Character Bible image(s) are missing or invalid in local storage for: '
      + names.join(', ')
      + '. Re-upload the reference image(s) before generating this scene.'
    );
    this.name = 'CharacterReferenceImageLoadError';
    this.code = 'CHARACTER_REFERENCE_IMAGE_MISSING';
    this.characterIds = names;
  }
}

/**
 * Load every saved Character Bible image selected by the scene cast.
 * Never silently omit a profile that explicitly points to a stored image:
 * doing so would let generation continue without the requested identity anchor.
 */
export async function loadCharacterReferenceImagesFromStorage({
  scene,
  characterBible = [],
  storage
} = {}) {
  if (!storage || typeof storage.get !== 'function') {
    throw new TypeError('Character reference image storage must provide get(assetId).');
  }

  const cast = normalizeSceneCast('', scene?.characters);
  const profiles = selectCharacterReferencesForScene(characterBible, cast);
  const images = [];
  const missingCharacterIds = [];

  for (const profile of profiles) {
    const assetId = String(profile.referenceImageAssetId || '').trim();
    if (!assetId) continue;

    const record = await storage.get(assetId);
    const blob = record?.blob;
    const mimeType = String(blob?.type || record?.mimeType || '').trim().toLowerCase();
    if (!blob || typeof blob.arrayBuffer !== 'function'
        || !Number.isFinite(Number(blob.size)) || Number(blob.size) <= 0
        || !ALLOWED_IMAGE_TYPES.has(mimeType)) {
      missingCharacterIds.push(profile.characterId);
      continue;
    }

    const fallbackName = profile.characterId + (IMAGE_EXTENSIONS[mimeType] || '.png');
    images.push({
      name: String(record.filename || fallbackName).trim() || fallbackName,
      blob
    });
  }

  if (missingCharacterIds.length) {
    throw new CharacterReferenceImageLoadError(missingCharacterIds);
  }

  return images;
}

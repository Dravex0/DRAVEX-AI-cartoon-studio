import { normalizeSceneCast } from './scene-cast.js';

/**
 * Resolve locally stored reference photos for the characters explicitly cast
 * in a scene. Only the first two usable images are returned because the
 * current studio workflow exposes at most two character-reference inputs.
 */
export async function loadCharacterReferenceImagesForScene(
  scene = {},
  characterBible = [],
  storage,
  limit = 2
) {
  if (!storage || typeof storage.get !== 'function') return [];
  const maxImages = Math.max(0, Math.min(2, Math.floor(Number(limit) || 0)));
  if (!maxImages) return [];

  const cast = normalizeSceneCast('', scene?.characters)
    .map(name => name.toLocaleLowerCase());
  if (!cast.length) return [];

  const profiles = Array.isArray(characterBible) ? characterBible : [];
  const images = [];
  for (const profile of profiles) {
    if (images.length >= maxImages) break;
    const characterId = String(profile?.characterId ?? '').trim();
    if (!characterId || !cast.includes(characterId.toLocaleLowerCase())) continue;
    const assetId = String(profile?.referenceImageAssetId ?? '').trim();
    if (!assetId) continue;

    const record = await storage.get(assetId);
    if (record?.blob?.size) {
      images.push({
        name: record.filename || characterId + '.png',
        blob: record.blob
      });
    }
  }
  return images;
}

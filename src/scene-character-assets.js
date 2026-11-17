import { validateCharacterRig } from './character-rig.js';
import { normalizeCharacterLayers } from './scene-character-layers.js';

/**
 * Return body-image URLs that the scene compositor will actually try to draw.
 * Facial overlays are intentionally excluded: a missing mouth asset should not
 * prevent an otherwise valid character body from being exported.
 */
export function collectSceneCharacterImageUrls(scene = {}) {
  const urls = new Set();
  for (const layer of normalizeCharacterLayers(scene?.characterLayers)) {
    if (layer.visible && layer.imageUrl) urls.add(layer.imageUrl);
  }
  for (const input of Array.isArray(scene?.characterRigs) ? scene.characterRigs.slice(0, 20) : []) {
    const report = validateCharacterRig(input);
    if (!report.passed) continue;
    for (const part of report.rig.parts) {
      if (part.imageUrl) urls.add(part.imageUrl);
    }
  }
  return [...urls];
}

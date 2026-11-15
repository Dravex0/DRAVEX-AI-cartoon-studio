/**
 * Decide whether separately rendered character sprites may be composited over scene media.
 *
 * AI-generated stills and image-to-video clips normally contain their own cast.
 * Overlaying cutout sprites on those full-frame assets can create duplicate characters.
 * An overlay is allowed over generated media only when the scene explicitly declares
 * that the media is a background plate without baked-in characters.
 */
export function shouldRenderCharacterLayers({ hasGeneratedMedia = false, characterCompositionMode = 'auto' } = {}) {
  if (!hasGeneratedMedia) return true;
  return characterCompositionMode === 'background-only';
}

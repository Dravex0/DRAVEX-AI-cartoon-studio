import { applyCharacterActionTimelineToLayers } from './character-action-runtime.js';

const MAX_CHARACTER_LAYERS = 12;
const clean = (value, max = 2048) => String(value ?? '').trim().slice(0, max);
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max, fallback) => Math.max(min, Math.min(max, finite(value, fallback)));

/** Normalize one independently rendered character sprite. Coordinates and size are viewport-relative. */
export function normalizeCharacterLayer(input = {}, index = 0) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    characterId: clean(source.characterId, 120),
    imageUrl: clean(source.imageUrl),
    x: clamp(source.x, 0, 1, 0.5),
    y: clamp(source.y, 0, 1, 0.5),
    width: clamp(source.width, 0.01, 2, 0.25),
    height: clamp(source.height, 0.01, 2, 0.4),
    rotation: clamp(source.rotation, -Math.PI * 2, Math.PI * 2, 0),
    scale: clamp(source.scale, 0.05, 4, 1),
    opacity: clamp(source.opacity, 0, 1, 1),
    zIndex: Math.round(clamp(source.zIndex, -1000, 1000, index)),
    flipX: source.flipX === true,
    visible: source.visible !== false
  };
}

/** Keep one stable layer per character, preserving input order for equal z-index values. */
export function normalizeCharacterLayers(layers) {
  if (!Array.isArray(layers)) return [];
  const result = [];
  const seen = new Set();
  for (const input of layers) {
    if (result.length >= MAX_CHARACTER_LAYERS) break;
    const layer = normalizeCharacterLayer(input, result.length);
    const key = layer.characterId.toLocaleLowerCase();
    if (!key || !layer.imageUrl || seen.has(key)) continue;
    seen.add(key);
    result.push(layer);
  }
  return result;
}

/**
 * Composite independently generated character sprites over a scene background.
 * The resolver owns asset loading; this function only draws already-ready images.
 */
export function drawCharacterLayers(context, layers, resolveImage, viewportWidth, viewportHeight, runtime = {}) {
  const width = Number(viewportWidth), height = Number(viewportHeight);
  if (!context || typeof context.drawImage !== 'function' || typeof resolveImage !== 'function'
    || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { drawn: 0, skipped: Array.isArray(layers) ? layers.length : 0 };
  }
  const baseLayers = normalizeCharacterLayers(layers);
  const motionTimeline = runtime && typeof runtime === 'object'
    ? (runtime.motionTimeline || runtime.actionTimeline)
    : null;
  const runtimeLayers = motionTimeline
    ? applyCharacterActionTimelineToLayers(baseLayers, motionTimeline, runtime.progress)
    : baseLayers;
  const normalized = runtimeLayers
    .map((layer, index) => ({ layer, index }))
    .filter(item => item.layer.visible)
    .sort((a, b) => a.layer.zIndex - b.layer.zIndex || a.index - b.index);
  let drawn = 0, skipped = Array.isArray(layers) ? layers.length - normalized.length : 0;
  for (const { layer } of normalized) {
    const image = resolveImage(layer.imageUrl, layer.characterId);
    const imageWidth = Number(image?.naturalWidth || image?.videoWidth || image?.width);
    const imageHeight = Number(image?.naturalHeight || image?.videoHeight || image?.height);
    if (!image || !Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) {
      skipped++;
      continue;
    }
    const drawWidth = layer.width * width;
    const drawHeight = layer.height * height;
    context.save();
    try {
      context.globalAlpha *= layer.opacity;
      context.translate(layer.x * width, layer.y * height);
      context.rotate(layer.rotation);
      context.scale(layer.scale * (layer.flipX ? -1 : 1), layer.scale);
      context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      drawn++;
    } finally {
      context.restore();
    }
  }
  return { drawn, skipped };
}


/**
 * Attach a generated sprite to its scene as a renderable character layer.
 * Existing placement is preserved when regenerating the same character sprite.
 */
export function attachCharacterSpriteToSceneLayers(scene = {}, asset = {}) {
  const source = scene && typeof scene === 'object' && !Array.isArray(scene) ? scene : {};
  const characterId = clean(asset?.characterId, 120);
  const imageUrl = clean(asset?.imageUrl);
  if (!characterId || !/^https:\/\//i.test(imageUrl)) {
    return { status: 'invalid', layers: normalizeCharacterLayers(source.characterLayers) };
  }
  const layers = normalizeCharacterLayers(source.characterLayers);
  const key = characterId.toLocaleLowerCase();
  const existingIndex = layers.findIndex(layer => layer.characterId.toLocaleLowerCase() === key);
  if (existingIndex >= 0) {
    layers[existingIndex] = normalizeCharacterLayer({
      ...layers[existingIndex],
      imageUrl
    }, existingIndex);
    return { status: 'updated', layers };
  }
  if (layers.length >= MAX_CHARACTER_LAYERS) {
    return { status: 'limit-reached', layers };
  }
  layers.push(normalizeCharacterLayer({
    characterId,
    imageUrl,
    x: 0.5,
    y: 0.68,
    width: 0.28,
    height: 0.46,
    zIndex: layers.length
  }, layers.length));
  return { status: 'added', layers };
}

export const CHARACTER_LAYER_LIMIT = MAX_CHARACTER_LAYERS;

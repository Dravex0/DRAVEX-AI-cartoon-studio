import { applyCharacterActionTimelineToLayers } from "./character-action-runtime.js";
import { applyCharacterRigPose, validateCharacterRig } from "./character-rig.js";
import { normalizeCharacterLayers } from "./scene-character-layers.js";

/**
 * Geometry and pixel diagnostics for character regions in the final composed canvas.
 * Pixel activity is evidence of visual change inside a region, not semantic action recognition.
 */
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function transformBounds(item, viewport, camera = {}) {
  const width = finite(viewport?.width, 0);
  const height = finite(viewport?.height, 0);
  if (width <= 0 || height <= 0 || !item || item.visible === false) return null;

  const x = finite(item.x, NaN);
  const y = finite(item.y, NaN);
  const itemWidth = finite(item.width, NaN);
  const itemHeight = finite(item.height, NaN);
  if (![x, y, itemWidth, itemHeight].every(Number.isFinite) || itemWidth <= 0 || itemHeight <= 0) return null;

  const scale = Math.max(0, finite(item.scale, 1));
  const zoom = Math.max(0.01, finite(camera.zoom, 1));
  const rotation = finite(item.rotation, 0);
  const focusX = finite(camera.focusX, width / 2);
  const focusY = finite(camera.focusY, height / 2);
  const offsetY = finite(camera.offsetY, 0);

  const centerX = width / 2 + (x * width - focusX) * zoom;
  const centerY = height / 2 + offsetY + (y * height - focusY) * zoom;
  const scaledWidth = itemWidth * width * scale * zoom;
  const scaledHeight = itemHeight * height * scale * zoom;
  const cos = Math.abs(Math.cos(rotation));
  const sin = Math.abs(Math.sin(rotation));
  const halfWidth = (scaledWidth * cos + scaledHeight * sin) / 2;
  const halfHeight = (scaledWidth * sin + scaledHeight * cos) / 2;

  const left = clamp(centerX - halfWidth, 0, width);
  const top = clamp(centerY - halfHeight, 0, height);
  const right = clamp(centerX + halfWidth, 0, width);
  const bottom = clamp(centerY + halfHeight, 0, height);
  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Return the viewport-space bounding box of a normalized sprite layer after camera transforms. */
export function getCharacterLayerBounds(layer, viewport, camera = {}) {
  return transformBounds(layer, viewport, camera);
}

/** Return the union of all valid rig-part bounds for one character. */
export function getCharacterRigBounds(parts, viewport, camera = {}) {
  if (!Array.isArray(parts)) return null;
  return unionCharacterBounds(parts.map(part => transformBounds(part, viewport, camera)));
}

/** Combine sprite and rig bounds without mutating either input. */
export function unionCharacterBounds(regions) {
  const valid = Array.isArray(regions) ? regions.filter(region =>
    region && [region.x, region.y, region.width, region.height].every(Number.isFinite)
      && region.width > 0 && region.height > 0
  ) : [];
  if (!valid.length) return null;
  const left = Math.min(...valid.map(region => region.x));
  const top = Math.min(...valid.map(region => region.y));
  const right = Math.max(...valid.map(region => region.x + region.width));
  const bottom = Math.max(...valid.map(region => region.y + region.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}


/**
 * Derive the visible viewport-space region for each character at one scene timestamp.
 * Sprite transforms and validated rig-part transforms use the same camera transform
 * as the compositor. This is geometry only; it does not prove which pixels belong
 * to the character when transparent assets, occlusion, or background overlap occur.
 */
export function buildCompositedCharacterRegions({
  layers = [],
  characterRigs = [],
  rigPoses = {},
  motionTimeline = null,
  progress = 0,
  viewport,
  camera = {},
  resolveImage = null
} = {}) {
  if (!viewport || !Number.isFinite(Number(viewport.width)) || !Number.isFinite(Number(viewport.height))
      || Number(viewport.width) <= 0 || Number(viewport.height) <= 0) {
    throw new TypeError("A positive logical viewport is required.");
  }
  // Match the compositor: discard invalid/duplicate layers and apply the same defaults.
  const safeLayers = normalizeCharacterLayers(layers);
  const movedLayers = motionTimeline
    ? applyCharacterActionTimelineToLayers(safeLayers, motionTimeline, progress)
    : safeLayers.map(layer => layer && typeof layer === "object" ? { ...layer } : layer);
  const readyRigCharacterIds = new Set();
  if (typeof resolveImage === "function") {
    for (const input of Array.isArray(characterRigs) ? characterRigs.slice(0, 20) : []) {
      const report = validateCharacterRig(input);
      if (!report.passed) continue;
      const ready = report.rig.parts.every(part => {
        const image = resolveImage(part.imageUrl, report.rig.characterId);
        const imageWidth = Number(image?.naturalWidth || image?.videoWidth || image?.width);
        const imageHeight = Number(image?.naturalHeight || image?.videoHeight || image?.height);
        return Boolean(image && Number.isFinite(imageWidth) && Number.isFinite(imageHeight)
          && imageWidth > 0 && imageHeight > 0);
      });
      if (ready) readyRigCharacterIds.add(report.rig.characterId.toLocaleLowerCase());
    }
  }
  const regions = new Map();
  const add = (characterId, bounds, source) => {
    const id = String(characterId || "").trim();
    if (!id || !bounds) return;
    const key = id.toLocaleLowerCase();
    const previous = regions.get(key);
    regions.set(key, {
      characterId: previous?.characterId || id,
      bounds: unionCharacterBounds([previous?.bounds, bounds]),
      sources: [...new Set([...(previous?.sources || []), source])]
    });
  };

  for (const layer of movedLayers) {
    if (!layer || typeof layer !== "object" || layer.visible === false) continue;
    // The preview renderer suppresses the legacy sprite when all rig assets are ready.
    if (readyRigCharacterIds.has(String(layer.characterId || "").toLocaleLowerCase())) continue;
    add(layer.characterId, getCharacterLayerBounds(layer, viewport, camera), "sprite");
  }

  for (const input of Array.isArray(characterRigs) ? characterRigs.slice(0, 20) : []) {
    const report = validateCharacterRig(input);
    if (!report.passed || typeof resolveImage !== "function") continue;
    // The renderer suppresses the whole sprite only when every rig-part image is ready.
    // Do not include rig bounds when the renderer would fall back to the sprite.
    const rigImagesReady = report.rig.parts.every(part => {
      const image = resolveImage(part.imageUrl, report.rig.characterId);
      const imageWidth = Number(image?.naturalWidth || image?.videoWidth || image?.width);
      const imageHeight = Number(image?.naturalHeight || image?.videoHeight || image?.height);
      return Boolean(image && Number.isFinite(imageWidth) && Number.isFinite(imageHeight)
        && imageWidth > 0 && imageHeight > 0);
    });
    if (!rigImagesReady) continue;
    const candidate = rigPoses && typeof rigPoses === "object"
      ? (rigPoses[report.rig.characterId] || Object.entries(rigPoses).find(([key]) =>
          key.toLocaleLowerCase() === report.rig.characterId.toLocaleLowerCase())?.[1])
      : null;
    const pose = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate : {};
    const posedParts = applyCharacterRigPose(report.rig.parts, report.rig, pose);
    add(report.rig.characterId, getCharacterRigBounds(posedParts, viewport, camera), "rig");
  }

  return [...regions.values()].map(item => ({
    ...item,
    source: item.sources.length > 1 ? "sprite+rig" : item.sources[0]
  }));
}

/**
 * Copy a crop from the already-composited output canvas into a small readable canvas.
 * A SecurityError is allowed to reach the caller so the UI can report CORS restrictions.
 */
export function sampleCanvasRegion(canvas, region, {
  width = 32,
  height = 32,
  scaleX = 1,
  scaleY = 1,
  canvasFactory = () => document.createElement("canvas")
} = {}) {
  if (!canvas || typeof canvas.width !== "number" || typeof canvas.height !== "number") {
    throw new TypeError("A source canvas is required.");
  }
  if (!region || ![region.x, region.y, region.width, region.height].every(Number.isFinite)
      || region.width <= 0 || region.height <= 0) {
    throw new TypeError("A positive character region is required.");
  }
  if (![width, height].every(value => Number.isInteger(value) && value > 0 && value <= 128)) {
    throw new RangeError("Sample dimensions must be integers from 1 to 128.");
  }
  if (![scaleX, scaleY].every(value => Number.isFinite(value) && value > 0)) {
    throw new RangeError("Canvas coordinate scales must be finite positive numbers.");
  }
  if (typeof canvasFactory !== "function") throw new TypeError("canvasFactory must be a function.");
  const left = clamp(region.x * scaleX, 0, canvas.width);
  const top = clamp(region.y * scaleY, 0, canvas.height);
  const right = clamp((region.x + region.width) * scaleX, 0, canvas.width);
  const bottom = clamp((region.y + region.height) * scaleY, 0, canvas.height);
  if (right <= left || bottom <= top) throw new RangeError("Character region is outside the source canvas.");

  const sampleCanvas = canvasFactory();
  const context = sampleCanvas?.getContext?.("2d", { willReadFrequently: true });
  if (!sampleCanvas || !context?.drawImage || !context?.getImageData) {
    throw new Error("A readable 2D canvas is required for character-region sampling.");
  }
  sampleCanvas.width = width;
  sampleCanvas.height = height;
  context.drawImage(canvas, left, top, right - left, bottom - top, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

/** Compare RGB pixel samples from the same final-composition region across time. */
export function analyzeCharacterRegionFrames(frames, {
  pixelDeltaThreshold = 0.06,
  staticMotionThreshold = 0.008,
  changedPixelThreshold = 0.01
} = {}) {
  if (!Array.isArray(frames) || frames.length < 2 || frames.length > 12) {
    throw new RangeError("At least 2 and at most 12 character-region frames are required.");
  }
  if (![pixelDeltaThreshold, staticMotionThreshold, changedPixelThreshold].every(Number.isFinite)
      || pixelDeltaThreshold < 0 || staticMotionThreshold < 0 || changedPixelThreshold < 0) {
    throw new RangeError("Motion thresholds must be finite non-negative numbers.");
  }
  const first = frames[0];
  const width = Number(first?.width), height = Number(first?.height);
  const byteLength = width * height * 4;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0
      || !first?.data || first.data.length !== byteLength) {
    throw new TypeError("Character-region frames must contain matching RGBA image data.");
  }
  for (const frame of frames) {
    if (Number(frame?.width) !== width || Number(frame?.height) !== height
        || !frame?.data || frame.data.length !== byteLength) {
      throw new TypeError("All character-region frames must have identical dimensions and RGBA data.");
    }
  }

  let totalChange = 0;
  let changedPixels = 0;
  let comparisons = 0;
  const pixelCount = width * height;
  for (let frameIndex = 1; frameIndex < frames.length; frameIndex += 1) {
    const previous = frames[frameIndex - 1].data;
    const current = frames[frameIndex].data;
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const offset = pixel * 4;
      const delta = (
        Math.abs(current[offset] - previous[offset]) +
        Math.abs(current[offset + 1] - previous[offset + 1]) +
        Math.abs(current[offset + 2] - previous[offset + 2])
      ) / (3 * 255);
      totalChange += delta;
      if (delta >= pixelDeltaThreshold) changedPixels += 1;
      comparisons += 1;
    }
  }
  const meanPixelChange = comparisons ? totalChange / comparisons : 0;
  const changedPixelRatio = comparisons ? changedPixels / comparisons : 0;
  const likelyStatic = meanPixelChange < staticMotionThreshold && changedPixelRatio < changedPixelThreshold;
  return {
    status: likelyStatic ? "likely-static" : "visible-change",
    sampleCount: frames.length,
    meanPixelChange: Number(meanPixelChange.toFixed(5)),
    changedPixelRatio: Number(changedPixelRatio.toFixed(4)),
    region: "composited-character-region",
    message: likelyStatic
      ? "Very little RGB pixel change was detected inside the sampled character region."
      : "RGB pixel changes were detected inside the sampled character region.",
    limitation: "Pixel activity does not prove a semantic character action and may include effects, lighting, occlusion, or background pixels."
  };
}

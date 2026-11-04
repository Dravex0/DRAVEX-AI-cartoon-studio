/**
 * Inspect alpha occupancy near the four edges of each rig-part image.
 * This is an asset diagnostic only: transparent edges may be intentional and
 * do not establish whether two body parts visually connect at a joint.
 */
const EDGES = Object.freeze(["top", "right", "bottom", "left"]);

function validImage(image) {
  const width = Number(image?.naturalWidth || image?.videoWidth || image?.width);
  const height = Number(image?.naturalHeight || image?.videoHeight || image?.height);
  return image && Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0
    ? { width, height } : null;
}

/**
 * @param {{rig: object, resolveImage: Function, canvasFactory?: Function,
 *  alphaThreshold?: number, edgeDepthRatio?: number, minimumOpaqueRatio?: number}} options
 */
export function analyzeRigPartAlphaEdges({
  rig,
  resolveImage,
  canvasFactory = () => document.createElement("canvas"),
  alphaThreshold = 16,
  edgeDepthRatio = 0.08,
  minimumOpaqueRatio = 0.05
} = {}) {
  if (!rig || !Array.isArray(rig.parts)) throw new TypeError("A rig with parts is required.");
  if (typeof resolveImage !== "function") throw new TypeError("resolveImage must be a function.");
  if (typeof canvasFactory !== "function") throw new TypeError("canvasFactory must be a function.");
  if (!Number.isInteger(alphaThreshold) || alphaThreshold < 0 || alphaThreshold > 255) {
    throw new RangeError("alphaThreshold must be an integer from 0 to 255.");
  }
  if (![edgeDepthRatio, minimumOpaqueRatio].every(Number.isFinite)
      || edgeDepthRatio <= 0 || edgeDepthRatio > 0.5
      || minimumOpaqueRatio < 0 || minimumOpaqueRatio > 1) {
    throw new RangeError("Edge and opacity ratios must be within their supported ranges.");
  }

  const parts = [];
  for (const part of rig.parts.slice(0, 24)) {
    const image = resolveImage(part?.imageUrl, rig.characterId);
    const dimensions = validImage(image);
    if (!dimensions) {
      parts.push({ partId: String(part?.id || ""), status: "image-unavailable", edges: {} });
      continue;
    }
    try {
      const canvas = canvasFactory();
      const context = canvas?.getContext?.("2d", { willReadFrequently: true });
      if (!canvas || !context?.drawImage || !context?.getImageData) {
        throw new Error("Readable 2D canvas unavailable.");
      }
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
      const pixels = context.getImageData(0, 0, dimensions.width, dimensions.height);
      const data = pixels?.data;
      if (!data || data.length !== dimensions.width * dimensions.height * 4) {
        throw new Error("Invalid RGBA pixel buffer.");
      }
      const depthX = Math.max(1, Math.ceil(dimensions.width * edgeDepthRatio));
      const depthY = Math.max(1, Math.ceil(dimensions.height * edgeDepthRatio));
      const edgeSpecs = {
        top: { count: depthY * dimensions.width, test: (x, y) => y < depthY },
        bottom: { count: depthY * dimensions.width, test: (x, y) => y >= dimensions.height - depthY },
        left: { count: depthX * dimensions.height, test: (x, y) => x < depthX },
        right: { count: depthX * dimensions.height, test: (x, y) => x >= dimensions.width - depthX }
      };
      const edges = {};
      for (const edge of EDGES) {
        let opaque = 0;
        const spec = edgeSpecs[edge];
        for (let y = 0; y < dimensions.height; y++) {
          for (let x = 0; x < dimensions.width; x++) {
            if (spec.test(x, y) && data[(y * dimensions.width + x) * 4 + 3] > alphaThreshold) opaque++;
          }
        }
        const opaqueRatio = opaque / spec.count;
        edges[edge] = {
          opaqueRatio: Number(opaqueRatio.toFixed(4)),
          transparentRatio: Number((1 - opaqueRatio).toFixed(4)),
          status: opaqueRatio < minimumOpaqueRatio ? "mostly-transparent" : "alpha-present"
        };
      }
      parts.push({ partId: String(part?.id || ""), status: "analyzed", width: dimensions.width, height: dimensions.height, edges });
    } catch (error) {
      parts.push({
        partId: String(part?.id || ""),
        status: "pixels-unavailable",
        reason: error?.name === "SecurityError" ? "cors-tainted-canvas" : "canvas-read-failed",
        edges: {}
      });
    }
  }
  return {
    characterId: String(rig.characterId || ""),
    status: parts.length && parts.every(part => part.status === "analyzed") ? "complete"
      : parts.some(part => part.status === "analyzed") ? "partial" : "unavailable",
    analyzedParts: parts.filter(part => part.status === "analyzed").length,
    unavailableParts: parts.filter(part => part.status !== "analyzed").length,
    parts,
    limitation: "Edge alpha occupancy describes image transparency only. It does not know joint anchors, artwork anatomy, draw order or whether transparent margins are intentional; it cannot confirm a visible seam."
  };
}

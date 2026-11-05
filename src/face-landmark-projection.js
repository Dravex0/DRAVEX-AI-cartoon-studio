import { getImageCoverCrop } from "./image-frame.js";

const finite = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));

/**
 * Map a normalized source-image point through the exact cover crop used by
 * drawImageCover. The returned coordinates are in the logical scene viewport,
 * before the outer cinematic camera transform applied by app.js.
 */
export function mapNormalizedImagePointToCoverViewport(
  point,
  sourceWidth,
  sourceHeight,
  viewportWidth,
  viewportHeight,
  coverOptions = {}
) {
  if (!point || !finite(point.x) || !finite(point.y)) {
    return { status: "invalid-point", point: null };
  }
  const crop = getImageCoverCrop(
    sourceWidth,
    sourceHeight,
    viewportWidth,
    viewportHeight,
    coverOptions.zoom,
    coverOptions.panX,
    coverOptions.panY
  );
  if (!crop) return { status: "invalid-dimensions", point: null };

  const sourceX = Number(point.x) * Number(sourceWidth);
  const sourceY = Number(point.y) * Number(sourceHeight);
  return {
    status: "mapped",
    point: {
      x: (sourceX - crop.sx) / crop.sw * crop.dw,
      y: (sourceY - crop.sy) / crop.sh * crop.dh
    },
    coordinateSpace: "cover-viewport",
    crop
  };
}

/**
 * Apply the same outer scene-camera transform used in app.js:
 * translate(viewport center + vertical offset), scale(zoom), then translate
 * by the negative focus point. Input and output remain logical canvas units.
 */
export function mapCoverViewportPointToSceneCanvas(
  point,
  viewportWidth,
  viewportHeight,
  camera = {}
) {
  if (!point || !finite(point.x) || !finite(point.y)) {
    return { status: "invalid-point", point: null };
  }
  const width = Number(viewportWidth);
  const height = Number(viewportHeight);
  if (![width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return { status: "invalid-dimensions", point: null };
  }
  const zoom = finite(camera.zoom) ? Number(camera.zoom) : 1;
  const offsetY = finite(camera.offsetY) ? Number(camera.offsetY) : 0;
  const focusX = finite(camera.focusX) ? Number(camera.focusX) : width / 2;
  const focusY = finite(camera.focusY) ? Number(camera.focusY) : height / 2;
  if (zoom <= 0) return { status: "invalid-camera", point: null };

  return {
    status: "mapped",
    point: {
      x: width / 2 + (Number(point.x) - focusX) * zoom,
      y: height / 2 + offsetY + (Number(point.y) - focusY) * zoom
    },
    coordinateSpace: "scene-canvas"
  };
}

/** Compose cover cropping and the outer scene-camera transform. */
export function mapNormalizedImagePointToSceneCanvas(
  point,
  sourceWidth,
  sourceHeight,
  viewportWidth,
  viewportHeight,
  { cover = {}, camera = {} } = {}
) {
  const covered = mapNormalizedImagePointToCoverViewport(
    point, sourceWidth, sourceHeight, viewportWidth, viewportHeight, cover
  );
  if (covered.status !== "mapped") return covered;
  const transformed = mapCoverViewportPointToSceneCanvas(
    covered.point, viewportWidth, viewportHeight, camera
  );
  if (transformed.status !== "mapped") return transformed;
  return {
    ...transformed,
    sourcePoint: { x: Number(point.x), y: Number(point.y) },
    coverPoint: covered.point,
    crop: covered.crop
  };
}

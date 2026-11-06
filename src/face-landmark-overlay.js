import { mapNormalizedImagePointToSceneCanvas } from "./face-landmark-projection.js";

const finite = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));

/**
 * Project only geometric face diagnostics into the final scene canvas.
 * This helper does not associate a face with a character or edit any pixels.
 */
export function projectFaceLandmarkOverlay(
  anchors,
  sourceWidth,
  sourceHeight,
  viewportWidth,
  viewportHeight,
  options = {}
) {
  if (!anchors || typeof anchors !== "object" || !anchors.faceBounds
      || !finite(anchors.faceBounds.x) || !finite(anchors.faceBounds.y)
      || !finite(anchors.faceBounds.width) || !finite(anchors.faceBounds.height)
      || Number(anchors.faceBounds.width) <= 0 || Number(anchors.faceBounds.height) <= 0) {
    return { status: "invalid-anchors", overlay: null };
  }
  const bounds = anchors.faceBounds;
  const points = {
    topLeft: { x: Number(bounds.x), y: Number(bounds.y) },
    topRight: { x: Number(bounds.x) + Number(bounds.width), y: Number(bounds.y) },
    bottomLeft: { x: Number(bounds.x), y: Number(bounds.y) + Number(bounds.height) },
    bottomRight: { x: Number(bounds.x) + Number(bounds.width), y: Number(bounds.y) + Number(bounds.height) },
    eyeCenter: anchors.eyeCenter,
    mouthCenter: anchors.mouthCenter,
    leftEye: anchors.points?.leftEye,
    rightEye: anchors.points?.rightEye
  };
  const projected = {};
  for (const [name, point] of Object.entries(points)) {
    if (!point || !finite(point.x) || !finite(point.y)) {
      if (name === "leftEye" || name === "rightEye") continue;
      return { status: "invalid-anchors", overlay: null };
    }
    const result = mapNormalizedImagePointToSceneCanvas(
      point, sourceWidth, sourceHeight, viewportWidth, viewportHeight, options
    );
    if (result.status !== "mapped") return { status: result.status, overlay: null };
    projected[name] = result.point;
  }
  const left = Math.min(projected.topLeft.x, projected.topRight.x, projected.bottomLeft.x, projected.bottomRight.x);
  const right = Math.max(projected.topLeft.x, projected.topRight.x, projected.bottomLeft.x, projected.bottomRight.x);
  const top = Math.min(projected.topLeft.y, projected.topRight.y, projected.bottomLeft.y, projected.bottomRight.y);
  const bottom = Math.max(projected.topLeft.y, projected.topRight.y, projected.bottomLeft.y, projected.bottomRight.y);
  if (![left, right, top, bottom].every(Number.isFinite) || right <= left || bottom <= top) {
    return { status: "invalid-projection", overlay: null };
  }
  return {
    status: "ready",
    overlay: {
      bounds: { x: left, y: top, width: right - left, height: bottom - top },
      eyeCenter: projected.eyeCenter,
      mouthCenter: projected.mouthCenter,
      leftEye: projected.leftEye || null,
      rightEye: projected.rightEye || null,
      coordinateSpace: "scene-canvas"
    }
  };
}

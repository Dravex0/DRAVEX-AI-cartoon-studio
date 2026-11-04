import { applyCharacterRigPose, validateCharacterRig } from "./character-rig.js";

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function boundsForPart(part, viewport, camera) {
  const width = Number(viewport.width), height = Number(viewport.height);
  const x = finite(part.x, NaN), y = finite(part.y, NaN);
  const partWidth = finite(part.width, NaN), partHeight = finite(part.height, NaN);
  if (![x, y, partWidth, partHeight].every(Number.isFinite) || partWidth <= 0 || partHeight <= 0) return null;

  const zoom = Math.max(0.01, finite(camera.zoom, 1));
  const focusX = finite(camera.focusX, width / 2);
  const focusY = finite(camera.focusY, height / 2);
  const offsetY = finite(camera.offsetY, 0);
  const centerX = width / 2 + (x * width - focusX) * zoom;
  const centerY = height / 2 + offsetY + (y * height - focusY) * zoom;
  const scaledWidth = partWidth * width * zoom;
  const scaledHeight = partHeight * height * zoom;
  const rotation = finite(part.rotation, 0);
  const cos = Math.abs(Math.cos(rotation)), sin = Math.abs(Math.sin(rotation));
  const halfWidth = (scaledWidth * cos + scaledHeight * sin) / 2;
  const halfHeight = (scaledWidth * sin + scaledHeight * cos) / 2;
  return {
    left: centerX - halfWidth,
    top: centerY - halfHeight,
    right: centerX + halfWidth,
    bottom: centerY + halfHeight
  };
}

function rectangleGap(a, b) {
  const dx = Math.max(0, a.left - b.right, b.left - a.right);
  const dy = Math.max(0, a.top - b.bottom, b.top - a.bottom);
  return { x: dx, y: dy, distance: Math.hypot(dx, dy) };
}

function nearestPartPair(parentParts, childParts, boundsByPart) {
  let best = null;
  for (const parentPart of parentParts) {
    const parentBounds = boundsByPart.get(parentPart.id);
    if (!parentBounds) continue;
    for (const childPart of childParts) {
      const childBounds = boundsByPart.get(childPart.id);
      if (!childBounds) continue;
      const gap = rectangleGap(parentBounds, childBounds);
      if (!best || gap.distance < best.gapPx) {
        best = {
          parentPartId: parentPart.id,
          childPartId: childPart.id,
          gapPx: Math.round(gap.distance * 100) / 100,
          horizontalGapPx: Math.round(gap.x * 100) / 100,
          verticalGapPx: Math.round(gap.y * 100) / 100,
          relation: gap.distance === 0 ? "overlap" : "separated"
        };
      }
    }
  }
  return best;
}

/**
 * Estimate whether connected rig-part rectangles overlap at their parent/child joints.
 * This is a geometry warning only: it does not inspect alpha pixels or prove a visible seam.
 */
export function analyzeCharacterRigJointContinuity({
  rig: rigInput,
  rigPose = {},
  viewport,
  camera = {},
  tolerancePx = 4
} = {}) {
  if (!viewport || !Number.isFinite(Number(viewport.width)) || !Number.isFinite(Number(viewport.height))
    || Number(viewport.width) <= 0 || Number(viewport.height) <= 0) {
    throw new TypeError("A positive viewport is required.");
  }
  if (!Number.isFinite(tolerancePx) || tolerancePx < 0) {
    throw new RangeError("tolerancePx must be a finite non-negative number.");
  }
  const validation = validateCharacterRig(rigInput);
  if (!validation.passed) {
    return {
      status: "invalid-rig",
      characterId: validation.rig.characterId,
      joints: [],
      skippedConnections: 0,
      issues: validation.issues
    };
  }

  const rig = validation.rig;
  const posedParts = applyCharacterRigPose(rig.parts, rig, rigPose);
  const boundsByPart = new Map(posedParts.map(part => [
    part.id,
    boundsForPart(part, viewport, camera)
  ]));
  const partsByBone = new Map();
  for (const part of posedParts) {
    const key = String(part.boneId).toLowerCase();
    if (!partsByBone.has(key)) partsByBone.set(key, []);
    partsByBone.get(key).push(part);
  }

  const joints = [];
  let skippedConnections = 0;
  for (const childBone of rig.bones) {
    if (!childBone.parentId) continue;
    const parentParts = partsByBone.get(childBone.parentId.toLowerCase()) || [];
    const childParts = partsByBone.get(childBone.id.toLowerCase()) || [];
    if (!parentParts.length || !childParts.length) continue;
    const nearest = nearestPartPair(parentParts, childParts, boundsByPart);
    if (!nearest) {
      skippedConnections++;
      continue;
    }
    joints.push({
      parentBoneId: childBone.parentId,
      childBoneId: childBone.id,
      ...nearest,
      status: nearest.gapPx > tolerancePx ? "possible-geometry-gap" : "overlap-or-near"
    });
  }

  const possibleGaps = joints.filter(item => item.status === "possible-geometry-gap");
  const status = !joints.length
    ? (skippedConnections ? "incomplete" : "no-connected-parts")
    : possibleGaps.length ? "possible-joint-gaps" : "geometry-overlap-or-near";
  return {
    status,
    characterId: rig.characterId,
    tolerancePx,
    checkedConnections: joints.length,
    possibleGapCount: possibleGaps.length,
    skippedConnections,
    joints,
    limitation: "Axis-aligned bounds estimate part geometry only. Transparent margins, artwork, occlusion and actual rendered pixels are not inspected; this is not visual seam detection."
  };
}

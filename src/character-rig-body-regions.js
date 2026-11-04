import { applyCharacterRigPose, validateCharacterRig } from "./character-rig.js";

const PARTS = Object.freeze([
  ["head", /head|neck/],
  ["torso", /torso|spine|chest|body/],
  ["left-arm", /left.*(arm|hand|shoulder)|(arm|hand|shoulder).*left|armleft|leftarm|larm/],
  ["right-arm", /right.*(arm|hand|shoulder)|(arm|hand|shoulder).*right|armright|rightarm|rarm/],
  ["left-leg", /left.*(leg|thigh|foot|ankle)|(leg|thigh|foot|ankle).*left|legleft|leftleg|lleg/],
  ["right-leg", /right.*(leg|thigh|foot|ankle)|(leg|thigh|foot|ankle).*right|legright|rightleg|rleg/]
]);

const normalize = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function classifyBone(boneId) {
  const id = normalize(boneId);
  for (const [bodyPart, pattern] of PARTS) {
    if (pattern.test(id)) return bodyPart;
  }
  return null;
}

function transformPartBounds(part, viewport, camera) {
  const width = finite(viewport?.width, 0);
  const height = finite(viewport?.height, 0);
  const x = finite(part?.x, NaN), y = finite(part?.y, NaN);
  const partWidth = finite(part?.width, NaN), partHeight = finite(part?.height, NaN);
  if (width <= 0 || height <= 0 || ![x, y, partWidth, partHeight].every(Number.isFinite)
    || partWidth <= 0 || partHeight <= 0) return null;

  const zoom = Math.max(0.01, finite(camera?.zoom, 1));
  const scale = Math.max(0, finite(part.scale, 1));
  const focusX = finite(camera?.focusX, width / 2);
  const focusY = finite(camera?.focusY, height / 2);
  const offsetY = finite(camera?.offsetY, 0);
  const centerX = width / 2 + (x * width - focusX) * zoom;
  const centerY = height / 2 + offsetY + (y * height - focusY) * zoom;
  const scaledWidth = partWidth * width * scale * zoom;
  const scaledHeight = partHeight * height * scale * zoom;
  const rotation = finite(part.rotation, 0);
  const cos = Math.abs(Math.cos(rotation)), sin = Math.abs(Math.sin(rotation));
  const halfWidth = (scaledWidth * cos + scaledHeight * sin) / 2;
  const halfHeight = (scaledWidth * sin + scaledHeight * cos) / 2;
  const left = clamp(centerX - halfWidth, 0, width);
  const top = clamp(centerY - halfHeight, 0, height);
  const right = clamp(centerX + halfWidth, 0, width);
  const bottom = clamp(centerY + halfHeight, 0, height);
  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function unionBounds(bounds) {
  const valid = bounds.filter(Boolean);
  if (!valid.length) return null;
  const left = Math.min(...valid.map(item => item.x));
  const top = Math.min(...valid.map(item => item.y));
  const right = Math.max(...valid.map(item => item.x + item.width));
  const bottom = Math.max(...valid.map(item => item.y + item.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Build viewport-space sample regions for the six principal body areas.
 * Regions follow the validated rig's current bone pose and camera transform.
 * These are rig-geometry estimates, not semantic pixel segmentation.
 */
export function buildCharacterBodyPartRegions({
  rig: rigInput,
  rigPose = {},
  viewport,
  camera = {}
} = {}) {
  if (!viewport || !Number.isFinite(Number(viewport.width)) || !Number.isFinite(Number(viewport.height))
    || Number(viewport.width) <= 0 || Number(viewport.height) <= 0) {
    throw new TypeError("A positive viewport is required.");
  }
  const report = validateCharacterRig(rigInput);
  if (!report.passed) {
    return { status: "invalid-rig", characterId: report.rig.characterId, regions: [], missing: PARTS.map(([id]) => id), issues: report.issues };
  }

  const bones = new Map(report.rig.bones.map(bone => [bone.id.toLowerCase(), bone]));
  const posedParts = applyCharacterRigPose(report.rig.parts, report.rig, rigPose);
  const groups = new Map(PARTS.map(([id]) => [id, []]));
  const unclassifiedPartIds = [];

  for (const part of posedParts) {
    const bone = bones.get(String(part.boneId).toLowerCase());
    const bodyPart = bone ? classifyBone(bone.id) : null;
    if (!bodyPart) {
      unclassifiedPartIds.push(part.id);
      continue;
    }
    const bounds = transformPartBounds(part, viewport, camera);
    if (bounds) groups.get(bodyPart).push({ partId: part.id, boneId: bone.id, bounds });
  }

  const regions = [];
  const missing = [];
  for (const [bodyPart] of PARTS) {
    const entries = groups.get(bodyPart);
    const bounds = unionBounds(entries.map(item => item.bounds));
    if (!bounds) {
      missing.push(bodyPart);
      continue;
    }
    regions.push({
      bodyPart,
      characterId: report.rig.characterId,
      bounds,
      partIds: entries.map(item => item.partId),
      boneIds: [...new Set(entries.map(item => item.boneId))],
      geometrySource: "posed-rig-part-rectangles"
    });
  }

  return {
    status: regions.length === PARTS.length ? "complete" : regions.length ? "partial" : "no-classified-body-parts",
    characterId: report.rig.characterId,
    regions,
    missing,
    unclassifiedPartIds,
    limitation: "Regions are estimated from rig part rectangles. Transparent margins, occlusion, overlap and incorrect artwork can include background pixels; pixel activity does not prove a semantic body action."
  };
}

export const CHARACTER_BODY_PART_REGION_IDS = Object.freeze(PARTS.map(([id]) => id));

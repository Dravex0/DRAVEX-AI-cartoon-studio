import { validateCharacterFacialRig } from "./character-facial-rig.js";
import { applyCharacterRigPose } from "./character-rig.js";

const clamp = (value, min, max, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
};
const isRecord = value => Boolean(value && typeof value === "object" && !Array.isArray(value));

const VISEME_OPENNESS = Object.freeze({
  neutral: 0,
  open: 0.9,
  wide: 0.28,
  round: 0.62,
  closed: 0.02,
  teeth: 0.24
});

function expressionFor(characterId, expressions) {
  return isRecord(expressions) && isRecord(expressions[characterId]) ? expressions[characterId] : {};
}

/**
 * Draw explicit facial image layers over the scene.
 * Part coordinates and dimensions are normalized to the full scene viewport.
 * Facial art is additive: missing facial images never hide a working body sprite/rig.
 */
export function drawCharacterFacialRigs(context, facialRigs, resolveImage, viewportWidth, viewportHeight, runtime = {}) {
  const width = Number(viewportWidth), height = Number(viewportHeight);
  if (!context || typeof context.drawImage !== "function" || typeof resolveImage !== "function"
    || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { drawn: 0, skipped: Array.isArray(facialRigs) ? facialRigs.length : 0, readyCharacterIds: [] };
  }
  const bodyRigs = new Map((Array.isArray(runtime.characterRigs) ? runtime.characterRigs : [])
    .filter(rig => rig && typeof rig.characterId === "string")
    .map(rig => [rig.characterId.toLowerCase(), rig]));
  const visemes = isRecord(runtime.facialVisemes) ? runtime.facialVisemes : {};
  const openness = isRecord(runtime.facialMouthOpenness) ? runtime.facialMouthOpenness : {};
  const expressions = isRecord(runtime.facialExpressions) ? runtime.facialExpressions : {};
  const rigPoses = isRecord(runtime.rigPoses) ? runtime.rigPoses : {};
  let drawn = 0, skipped = 0;
  const readyCharacterIds = [];

  for (const input of Array.isArray(facialRigs) ? facialRigs.slice(0, 20) : []) {
    const candidateId = String(input?.characterId || "");
    const bodyRig = bodyRigs.get(candidateId.toLowerCase()) || null;
    const report = validateCharacterFacialRig(input, bodyRig);
    if (!report.passed) { skipped++; continue; }
    const rig = report.rig;
    const expression = expressionFor(rig.characterId, expressions);
    const bodyPose = isRecord(rigPoses[rig.characterId]) ? rigPoses[rig.characterId] : {};
    const headBase = bodyRig?.parts?.find(part => String(part?.boneId || "").toLowerCase() === rig.headBoneId.toLowerCase()) || null;
    const headPosed = headBase ? applyCharacterRigPose([headBase], bodyRig, bodyPose)[0] : null;
    const headRotationDelta = headBase && headPosed ? headPosed.rotation - headBase.rotation : 0;
    const headCos = Math.cos(headRotationDelta), headSin = Math.sin(headRotationDelta);
    // Dialogue visemes take priority; otherwise use the expression preset mouth shape.
    const explicitViseme = VISEME_OPENNESS[visemes[rig.characterId]] === undefined ? null : visemes[rig.characterId];
    const expressionViseme = VISEME_OPENNESS[expression.mouthShape] === undefined ? null : expression.mouthShape;
    const viseme = explicitViseme || expressionViseme;
    const mouthOpen = viseme === null
      ? clamp(expression.mouthOpen, 0, 1, 0)
      : Math.max(clamp(expression.mouthOpen, 0, 1, 0), VISEME_OPENNESS[viseme])
        * clamp(openness[rig.characterId], 0, 1, 1);
    const eyeOpen = clamp(expression.eyeOpen, 0, 1, 1);
    const browY = clamp(expression.browY, -1, 1, 0);
    const browRotation = clamp(expression.browRotation, -Math.PI, Math.PI, 0);
    const mouthWidth = clamp(expression.mouthWidth, 0.25, 2, 1);
    let rigDrawn = 0;
    const parts = [...rig.parts].sort((a, b) => a.zIndex - b.zIndex);
    for (const part of parts) {
      const image = resolveImage(part.imageUrl, rig.characterId);
      const imageWidth = Number(image?.naturalWidth || image?.videoWidth || image?.width);
      const imageHeight = Number(image?.naturalHeight || image?.videoHeight || image?.height);
      if (!image || !Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 0 || imageHeight <= 0) {
        skipped++;
        continue;
      }
      let scaleX = 1, scaleY = 1, offsetY = 0, rotation = part.rotation, alpha = 1;
      let partX = part.x, partY = part.y;
      if (headBase && headPosed) {
        const relativeX = part.x - headBase.x, relativeY = part.y - headBase.y;
        partX = headPosed.x + relativeX * headCos - relativeY * headSin;
        partY = headPosed.y + relativeX * headSin + relativeY * headCos;
        rotation += headRotationDelta;
      } else if (bodyRig) {
        const delta = applyCharacterRigPose([{ boneId: rig.headBoneId, x: part.x, y: part.y, rotation: part.rotation }], bodyRig, bodyPose)[0];
        partX = delta.x; partY = delta.y; rotation = delta.rotation;
      }
      if (part.role === "eye-left" || part.role === "eye-right") scaleY = Math.max(0.025, eyeOpen);
      if (part.role === "eyelid-left" || part.role === "eyelid-right") alpha = 1 - eyeOpen;
      if (part.role === "brow-left" || part.role === "brow-right") {
        offsetY = browY * part.height * height * 0.18;
        rotation += browRotation * (part.role === "brow-left" ? -1 : 1);
      }
      if (part.role === "mouth") {
        scaleX = mouthWidth;
        scaleY = Math.max(0.04, viseme === null ? Math.max(mouthOpen, 0.04) : mouthOpen);
      }
      if (part.role === "jaw") {
        // A separate jaw layer follows mouth opening instead of remaining static.
        offsetY += mouthOpen * part.height * height * 0.12;
        rotation += mouthOpen * 0.18;
      }
      context.save();
      try {
        context.globalAlpha *= alpha;
        context.translate(partX * width, partY * height + offsetY);
        context.rotate(rotation);
        context.scale(scaleX, scaleY);
        context.drawImage(image, -part.width * width / 2, -part.height * height / 2, part.width * width, part.height * height);
        drawn++;
        rigDrawn++;
      } finally {
        context.restore();
      }
    }
    if (rigDrawn > 0) readyCharacterIds.push(rig.characterId);
  }
  return { drawn, skipped, readyCharacterIds };
}

export const CHARACTER_FACIAL_VISEME_OPENNESS = VISEME_OPENNESS;

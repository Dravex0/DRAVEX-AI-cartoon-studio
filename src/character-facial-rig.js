const MAX_FACIAL_PARTS = 16;
const MAX_CHARACTERS = 20;
const ROLES = new Set(["face-base", "eye-left", "eye-right", "eyelid-left", "eyelid-right", "brow-left", "brow-right", "mouth", "jaw"]);
const MOUTH_SHAPES = new Set(["neutral", "open", "wide", "round", "closed", "teeth"]);
const clean = (value, max = 120) => String(value ?? "").trim().slice(0, max);
const isRecord = value => Boolean(value && typeof value === "object" && !Array.isArray(value));
const finite = (value, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max, fallback = 0) => Math.max(min, Math.min(max, finite(value, fallback)));

function normalizePart(input = {}, index = 0) {
  const source = isRecord(input) ? input : {};
  const imageUrl = clean(source.imageUrl, 2048);
  return {
    id: clean(source.id),
    role: clean(source.role, 32).toLowerCase(),
    imageUrl: /^(https:\/\/|blob:)/i.test(imageUrl) ? imageUrl : "",
    x: clamp(source.x, -1, 1),
    y: clamp(source.y, -1, 1),
    width: clamp(source.width, 0.001, 1, 0.1),
    height: clamp(source.height, 0.001, 1, 0.1),
    rotation: clamp(source.rotation, -Math.PI * 2, Math.PI * 2),
    zIndex: Math.round(clamp(source.zIndex, -1000, 1000, index))
  };
}

/** Normalize explicitly supplied facial image parts; this does not slice a full-face image. */
export function normalizeCharacterFacialRig(input = {}) {
  const source = isRecord(input) ? input : {};
  return {
    schemaVersion: source.schemaVersion,
    characterId: clean(source.characterId),
    headBoneId: clean(source.headBoneId),
    parts: (Array.isArray(source.parts) ? source.parts : []).slice(0, MAX_FACIAL_PARTS).map(normalizePart)
  };
}

export function validateCharacterFacialRig(input = {}, bodyRig = null) {
  const rig = normalizeCharacterFacialRig(input);
  const issues = [];
  if (rig.schemaVersion !== 1) issues.push({ code: "facial-rig-schema-invalid", message: "Facial rig schemaVersion must be 1." });
  if (!rig.characterId) issues.push({ code: "facial-rig-character-missing", message: "A facial rig must belong to a character ID." });
  if (!rig.headBoneId) issues.push({ code: "facial-rig-head-bone-missing", message: "A facial rig must reference its head bone." });
  if (!rig.parts.length) issues.push({ code: "facial-rig-parts-empty", message: "Add at least one independently supplied facial image part." });
  const ids = new Set();
  for (const part of rig.parts) {
    const key = part.id.toLowerCase();
    if (!part.id) issues.push({ code: "facial-part-id-missing", message: "Every facial part needs an ID." });
    else if (ids.has(key)) issues.push({ code: "facial-part-id-duplicate", message: "Facial part IDs must be unique." });
    ids.add(key);
    if (!ROLES.has(part.role)) issues.push({ code: "facial-part-role-invalid", message: "Facial part role is not supported." });
    if (!part.imageUrl) issues.push({ code: "facial-part-image-invalid", message: "Every facial part needs an HTTPS or local blob image URL." });
  }
  if (bodyRig) {
    const body = bodyRig && typeof bodyRig === "object" ? bodyRig : {};
    const boneIds = new Set((Array.isArray(body.bones) ? body.bones : []).map(bone => clean(bone?.id).toLowerCase()));
    if (!boneIds.has(rig.headBoneId.toLowerCase())) {
      issues.push({ code: "facial-head-bone-unresolved", message: "The facial rig headBoneId must match a bone in the character body rig." });
    }
    if (body.characterId && body.characterId !== rig.characterId) {
      issues.push({ code: "facial-character-mismatch", message: "Body rig and facial rig must belong to the same character." });
    }
  }
  return { status: issues.length ? "invalid" : "valid", passed: issues.length === 0, rig, issues };
}

const EXPRESSIONS = Object.freeze({
  neutral: { eyeOpen: 1, browY: 0, browRotation: 0, mouthOpen: 0, mouthWidth: 1, mouthShape: "neutral" },
  blink: { eyeOpen: 0, browY: 0, browRotation: 0, mouthOpen: 0, mouthWidth: 1, mouthShape: "neutral" },
  happy: { eyeOpen: 0.82, browY: -0.08, browRotation: 0.08, mouthOpen: 0.28, mouthWidth: 1.25, mouthShape: "wide" },
  sad: { eyeOpen: 0.72, browY: 0.18, browRotation: -0.16, mouthOpen: 0.08, mouthWidth: 0.9, mouthShape: "neutral" },
  surprised: { eyeOpen: 1, browY: -0.3, browRotation: 0, mouthOpen: 0.82, mouthWidth: 0.8, mouthShape: "round" },
  talk: { eyeOpen: 0.95, browY: 0, browRotation: 0, mouthOpen: 0.45, mouthWidth: 1, mouthShape: "open" }
});

export function listCharacterFacialExpressions() {
  return Object.keys(EXPRESSIONS);
}

/** Return a bounded expression pose; it describes controls and does not render facial art by itself. */
export function createCharacterFacialExpression(name, overrides = {}) {
  const preset = EXPRESSIONS[String(name ?? "").trim().toLowerCase()];
  if (!preset) return { status: "unknown-expression", expression: null, issues: [{ code: "facial-expression-unknown", message: "Choose neutral, blink, happy, sad, surprised, or talk." }] };
  const source = isRecord(overrides) ? overrides : {};
  const mouthShape = MOUTH_SHAPES.has(source.mouthShape) ? source.mouthShape : preset.mouthShape;
  return {
    status: "ready",
    expression: {
      eyeOpen: clamp(source.eyeOpen, 0, 1, preset.eyeOpen),
      browY: clamp(source.browY, -1, 1, preset.browY),
      browRotation: clamp(source.browRotation, -Math.PI, Math.PI, preset.browRotation),
      mouthOpen: clamp(source.mouthOpen, 0, 1, preset.mouthOpen),
      mouthWidth: clamp(source.mouthWidth, 0.25, 2, preset.mouthWidth),
      mouthShape
    },
    issues: []
  };
}

/** Normalize per-character expression controls persisted with a scene. */
export function normalizeCharacterFacialExpressions(input = {}) {
  if (!isRecord(input)) return {};
  const result = {};
  for (const [characterId, raw] of Object.entries(input).slice(0, MAX_CHARACTERS)) {
    const key = clean(characterId);
    if (!key || !isRecord(raw)) continue;
    const expressionName = clean(raw.name, 32).toLowerCase();
    const base = createCharacterFacialExpression(EXPRESSIONS[expressionName] ? expressionName : "neutral", raw);
    if (base.status === "ready") result[key] = { name: EXPRESSIONS[expressionName] ? expressionName : "neutral", ...base.expression };
  }
  return result;
}

export const CHARACTER_FACIAL_RIG_LIMITS = Object.freeze({ parts: MAX_FACIAL_PARTS, characters: MAX_CHARACTERS });

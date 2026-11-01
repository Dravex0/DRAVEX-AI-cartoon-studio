import { validateCharacterFacialRig, createCharacterFacialExpression, normalizeCharacterFacialExpressions } from "./character-facial-rig.js";

const isRecord = value => Boolean(value && typeof value === "object" && !Array.isArray(value));
const clean = value => String(value ?? "").trim().slice(0, 120);
const ROLES = new Set(["face-base", "eye-left", "eye-right", "eyelid-left", "eyelid-right", "brow-left", "brow-right", "mouth", "jaw"]);

/** Upsert one explicitly supplied facial image part and validate its scene/character linkage. */
export function upsertCharacterFacialPart(scene = {}, input = {}) {
  const source = isRecord(scene) ? scene : {};
  const characterId = clean(input.characterId);
  const headBoneId = clean(input.headBoneId);
  const partId = clean(input.partId);
  const role = clean(input.role).toLowerCase();
  const imageUrl = String(input.imageUrl ?? "").trim().slice(0, 2048);
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const x = number(input.x, 0.5), y = number(input.y, 0.5);
  const width = number(input.width, 0.1), height = number(input.height, 0.1);
  const rotation = number(input.rotation, 0), zIndex = Math.round(number(input.zIndex, 10));
  const issues = [];
  if (!characterId) issues.push({ code: "facial-editor-character-missing", message: "Choose a character ID." });
  if (!headBoneId) issues.push({ code: "facial-editor-head-bone-missing", message: "Enter the head bone ID from the body rig." });
  if (!partId) issues.push({ code: "facial-editor-part-id-missing", message: "Enter a unique facial part ID." });
  if (!ROLES.has(role)) issues.push({ code: "facial-editor-role-invalid", message: "Choose a supported facial part role." });
  if (!/^(https:\/\/|blob:|dravex-facial-asset:)/i.test(imageUrl)) issues.push({ code: "facial-editor-image-invalid", message: "Use HTTPS, a current local blob URL, or a saved local facial asset." });
  if (x < -1 || x > 1 || y < -1 || y > 1 || width < 0.001 || width > 1 || height < 0.001 || height > 1 || Math.abs(rotation) > Math.PI * 2 || Math.abs(zIndex) > 1000) {
    issues.push({ code: "facial-editor-geometry-invalid", message: "Part geometry is outside the supported bounds." });
  }
  if (issues.length) return { status: "invalid", scene: source, issues, rig: null };
  const rigs = Array.isArray(source.characterFacialRigs) ? source.characterFacialRigs : [];
  const existing = rigs.find(rig => clean(rig?.characterId).toLowerCase() === characterId.toLowerCase());
  const parts = Array.isArray(existing?.parts) ? [...existing.parts] : [];
  const part = { id: partId, role, imageUrl, x, y, width, height, rotation, zIndex };
  const partIndex = parts.findIndex(item => clean(item?.id).toLowerCase() === partId.toLowerCase());
  if (partIndex >= 0) parts[partIndex] = part;
  else if (parts.length >= 16) return { status: "invalid", scene: source, rig: existing || null, issues: [{ code: "facial-editor-part-limit", message: "A facial rig supports at most 16 parts." }] };
  else parts.push(part);
  const rig = { schemaVersion: 1, characterId, headBoneId, parts };
  const bodyRig = (Array.isArray(source.characterRigs) ? source.characterRigs : []).find(item => clean(item?.characterId).toLowerCase() === characterId.toLowerCase()) || null;
  const report = validateCharacterFacialRig(rig, bodyRig);
  if (!report.passed) return { status: "invalid", scene: source, rig: report.rig, issues: report.issues };
  const nextRigs = existing
    ? rigs.map(item => clean(item?.characterId).toLowerCase() === characterId.toLowerCase() ? report.rig : item)
    : [...rigs, report.rig];
  return { status: partIndex >= 0 ? "updated" : "added", scene: { ...source, characterFacialRigs: nextRigs }, rig: report.rig, issues: [] };
}

/** Apply one bounded expression preset with optional numeric overrides to a scene. */
export function applyCharacterFacialExpressionToScene(scene = {}, characterIdInput, expressionName, overrides = {}) {
  const source = isRecord(scene) ? scene : {};
  const characterId = clean(characterIdInput);
  if (!characterId) return { status: "invalid", scene: source, issues: [{ code: "facial-expression-character-missing", message: "Choose a character ID." }] };
  const result = createCharacterFacialExpression(expressionName, overrides);
  if (result.status !== "ready") return { status: result.status, scene: source, issues: result.issues };
  const expressions = normalizeCharacterFacialExpressions(source.characterFacialExpressions);
  return { status: "ready", scene: { ...source, characterFacialExpressions: { ...expressions, [characterId]: { name: String(expressionName).toLowerCase(), ...result.expression } } }, expression: result.expression, issues: [] };
}

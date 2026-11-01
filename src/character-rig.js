const MAX_BONES = 24;
const MAX_PARTS = 24;
const clean = (value, max = 120) => String(value ?? '').trim().slice(0, max);
const isRecord = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const finite = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max, fallback = 0) => Math.max(min, Math.min(max, finite(value, fallback)));

function normalizeBone(input = {}) {
  const source = isRecord(input) ? input : {};
  return {
    id: clean(source.id),
    parentId: clean(source.parentId) || null,
    pivotX: clamp(source.pivotX, -2, 2),
    pivotY: clamp(source.pivotY, -2, 2),
    length: clamp(source.length, 0, 2)
  };
}

function normalizePart(input = {}, index = 0) {
  const source = isRecord(input) ? input : {};
  const imageUrl = clean(source.imageUrl, 2048);
  return {
    id: clean(source.id),
    boneId: clean(source.boneId),
    imageUrl: /^(https:\/\/|blob:)/i.test(imageUrl) ? imageUrl : '',
    x: clamp(source.x, -2, 2),
    y: clamp(source.y, -2, 2),
    width: clamp(source.width, 0.001, 2, 0.1),
    height: clamp(source.height, 0.001, 2, 0.1),
    rotation: clamp(source.rotation, -Math.PI * 2, Math.PI * 2),
    zIndex: Math.round(clamp(source.zIndex, -1000, 1000, index))
  };
}

/** Sanitize a rig definition while preserving invalid references for explicit validation feedback. */
export function normalizeCharacterRig(input = {}) {
  const source = isRecord(input) ? input : {};
  return {
    schemaVersion: source.schemaVersion,
    characterId: clean(source.characterId),
    bones: (Array.isArray(source.bones) ? source.bones : []).slice(0, MAX_BONES).map(normalizeBone),
    parts: (Array.isArray(source.parts) ? source.parts : []).slice(0, MAX_PARTS).map(normalizePart)
  };
}

/** Validate rig topology and asset bindings; no automatic body-part extraction is implied. */
export function validateCharacterRig(input = {}) {
  const rig = normalizeCharacterRig(input);
  const issues = [];
  if (rig.schemaVersion !== 1) issues.push({ code: 'rig-schema-invalid', message: 'Rig schemaVersion must be 1.' });
  if (!rig.characterId) issues.push({ code: 'rig-character-missing', message: 'A rig must belong to a character ID.' });
  if (!rig.bones.length || rig.bones.length > MAX_BONES) issues.push({ code: 'rig-bones-invalid', message: 'A rig must contain between 1 and 24 bones.' });
  if (!rig.parts.length || rig.parts.length > MAX_PARTS) issues.push({ code: 'rig-parts-invalid', message: 'A rig must contain between 1 and 24 image parts.' });

  const boneIds = new Set();
  for (const bone of rig.bones) {
    if (!bone.id) issues.push({ code: 'bone-id-missing', message: 'Every bone needs an ID.' });
    else if (boneIds.has(bone.id.toLowerCase())) issues.push({ code: 'bone-id-duplicate', message: 'Bone IDs must be unique.' });
    boneIds.add(bone.id.toLowerCase());
  }
  const roots = rig.bones.filter(bone => !bone.parentId);
  if (rig.bones.length && roots.length !== 1) issues.push({ code: 'rig-root-count-invalid', message: 'A rig must have exactly one root bone.' });
  for (const bone of rig.bones) {
    if (bone.parentId && !boneIds.has(bone.parentId.toLowerCase())) {
      issues.push({ code: 'bone-parent-missing', message: 'Every parent bone reference must resolve.' });
    }
    if (bone.parentId && bone.parentId.toLowerCase() === bone.id.toLowerCase()) {
      issues.push({ code: 'bone-self-parent', message: 'A bone cannot be its own parent.' });
    }
  }
  const byId = new Map(rig.bones.map(bone => [bone.id.toLowerCase(), bone]));
  for (const bone of rig.bones) {
    const visited = new Set();
    let current = bone;
    while (current?.parentId) {
      const key = current.id.toLowerCase();
      if (visited.has(key)) {
        issues.push({ code: 'bone-cycle', message: 'Bone hierarchy must not contain cycles.' });
        break;
      }
      visited.add(key);
      current = byId.get(current.parentId.toLowerCase());
      if (!current) break;
    }
  }

  const partIds = new Set();
  for (const part of rig.parts) {
    if (!part.id) issues.push({ code: 'part-id-missing', message: 'Every image part needs an ID.' });
    else if (partIds.has(part.id.toLowerCase())) issues.push({ code: 'part-id-duplicate', message: 'Part IDs must be unique.' });
    partIds.add(part.id.toLowerCase());
    if (!boneIds.has(part.boneId.toLowerCase())) issues.push({ code: 'part-bone-missing', message: 'Every image part must reference an existing bone.' });
    if (!part.imageUrl) issues.push({ code: 'part-image-invalid', message: 'Every image part needs an HTTPS or local blob image URL.' });
  }
  return { status: issues.length ? 'invalid' : 'valid', passed: issues.length === 0, rig, issues };
}

/**
 * Apply explicit per-frame bone offsets/rotations to independently supplied part layers.
 * Pose entries are keyed by bone ID; this deliberately does not infer poses from text.
 */
export function applyCharacterRigPose(parts, rigInput, pose = {}) {
  if (!Array.isArray(parts)) return [];
  const report = validateCharacterRig(rigInput);
  if (!report.passed || !isRecord(pose)) return parts.map(part => ({ ...part }));
  const bones = new Map(report.rig.bones.map(bone => [bone.id.toLowerCase(), bone]));
  return parts.map(part => {
    if (!isRecord(part)) return part;
    const bone = bones.get(clean(part.boneId).toLowerCase());
    if (!bone) return { ...part };
    const delta = isRecord(pose[bone.id]) ? pose[bone.id] : {};
    return {
      ...part,
      x: finite(part.x) + clamp(delta.x, -2, 2),
      y: finite(part.y) + clamp(delta.y, -2, 2),
      rotation: finite(part.rotation) + clamp(delta.rotation, -Math.PI * 2, Math.PI * 2)
    };
  });
}

export const CHARACTER_RIG_LIMITS = Object.freeze({ bones: MAX_BONES, parts: MAX_PARTS });

const MAX_BONES = 24;
const MAX_PARTS = 24;
const clean = (value, max = 120) => String(value ?? '').trim().slice(0, max);
const isRecord = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const finite = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max, fallback = 0) => Math.max(min, Math.min(max, finite(value, fallback)));

function poseForBone(pose, boneId) {
  if (!isRecord(pose)) return {};
  if (Object.prototype.hasOwnProperty.call(pose, boneId)) {
    return isRecord(pose[boneId]) ? pose[boneId] : {};
  }
  const normalizedId = String(boneId).toLowerCase();
  const matchingKey = Object.keys(pose).find(key => key.toLowerCase() === normalizedId);
  const value = matchingKey === undefined ? null : pose[matchingKey];
  return isRecord(value) ? value : {};
}


function normalizeBone(input = {}) {
  const source = isRecord(input) ? input : {};
  const hasPivotX = typeof source.pivotX === 'number' && Number.isFinite(source.pivotX);
  const hasPivotY = typeof source.pivotY === 'number' && Number.isFinite(source.pivotY);
  return {
    id: clean(source.id),
    parentId: clean(source.parentId) || null,
    pivotX: clamp(source.pivotX, -2, 2),
    pivotY: clamp(source.pivotY, -2, 2),
    pivotEnabled: hasPivotX && hasPivotY,
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
  for (const [index, sourceBone] of (Array.isArray(input?.bones) ? input.bones : []).slice(0, MAX_BONES).entries()) {
    const hasPivotX = typeof sourceBone?.pivotX === 'number' && Number.isFinite(sourceBone.pivotX);
    const hasPivotY = typeof sourceBone?.pivotY === 'number' && Number.isFinite(sourceBone.pivotY);
    if (hasPivotX !== hasPivotY) {
      issues.push({ code: 'bone-pivot-incomplete', message: 'A bone pivot must define both pivotX and pivotY, or omit both.' });
    }
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
    let current = bones.get(clean(part.boneId).toLowerCase());
    if (!current) return { ...part };
    const chain = [];
    const visited = new Set();
    while (current && !visited.has(current.id.toLowerCase())) {
      visited.add(current.id.toLowerCase());
      chain.push(current);
      current = current.parentId ? bones.get(current.parentId.toLowerCase()) : null;
    }
    chain.reverse();

    // Affine transform from the part's rest position into its posed position.
    // Pivot coordinates share the normalized viewport coordinate space with part x/y.
    let a = 1, b = 0, c = 0, d = 1, e = 0, f = 0;
    let rotation = 0;
    for (const bone of chain) {
      const delta = poseForBone(pose, bone.id);
      const boneRotation = clamp(delta.rotation, -Math.PI * 2, Math.PI * 2);
      if (bone.pivotEnabled && boneRotation !== 0) {
        const pivotX = a * bone.pivotX + c * bone.pivotY + e;
        const pivotY = b * bone.pivotX + d * bone.pivotY + f;
        const cos = Math.cos(boneRotation), sin = Math.sin(boneRotation);
        const nextA = cos * a - sin * b;
        const nextB = sin * a + cos * b;
        const nextC = cos * c - sin * d;
        const nextD = sin * c + cos * d;
        const nextE = pivotX + cos * (e - pivotX) - sin * (f - pivotY);
        const nextF = pivotY + sin * (e - pivotX) + cos * (f - pivotY);
        a = nextA; b = nextB; c = nextC; d = nextD; e = nextE; f = nextF;
      }
      // Keep legacy pose offsets in viewport space; descendants inherit every ancestor offset.
      e += clamp(delta.x, -2, 2);
      f += clamp(delta.y, -2, 2);
      rotation += boneRotation;
    }
    return {
      ...part,
      x: a * finite(part.x) + c * finite(part.y) + e,
      y: b * finite(part.x) + d * finite(part.y) + f,
      rotation: finite(part.rotation) + rotation
    };
  });
}

export const CHARACTER_RIG_LIMITS = Object.freeze({ bones: MAX_BONES, parts: MAX_PARTS });


/** Normalize explicit per-character/per-bone pose offsets stored on a scene. */

/** Resolve saved per-character rig poses using exact IDs first, then case-insensitive fallback. */
export function characterRigPosesFor(characterId, values = {}) {
  if (!isRecord(values)) return {};
  if (Object.prototype.hasOwnProperty.call(values, characterId)) {
    return isRecord(values[characterId]) ? values[characterId] : {};
  }
  const normalizedId = String(characterId).toLowerCase();
  const matchingKey = Object.keys(values).find(key => key.toLowerCase() === normalizedId);
  const value = matchingKey === undefined ? null : values[matchingKey];
  return isRecord(value) ? value : {};
}

export function normalizeCharacterRigPoses(input = {}) {
  if (!isRecord(input)) return {};
  const result = {};
  for (const [characterId, rawBones] of Object.entries(input).slice(0, 20)) {
    const characterKey = clean(characterId);
    if (!characterKey || !isRecord(rawBones)) continue;
    const bones = {};
    for (const [boneId, rawPose] of Object.entries(rawBones).slice(0, MAX_BONES)) {
      const boneKey = clean(boneId);
      if (!boneKey || !isRecord(rawPose)) continue;
      const pose = {};
      if (typeof rawPose.x === 'number' && Number.isFinite(rawPose.x)) pose.x = clamp(rawPose.x, -2, 2);
      if (typeof rawPose.y === 'number' && Number.isFinite(rawPose.y)) pose.y = clamp(rawPose.y, -2, 2);
      if (typeof rawPose.rotation === 'number' && Number.isFinite(rawPose.rotation)) {
        pose.rotation = clamp(rawPose.rotation, -Math.PI * 2, Math.PI * 2);
      }
      if (Object.keys(pose).length) bones[boneKey] = pose;
    }
    if (Object.keys(bones).length) result[characterKey] = bones;
  }
  return result;
}

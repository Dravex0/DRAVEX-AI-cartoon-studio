const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const key = value => clean(value, 120).toLocaleLowerCase();

const PARTS = Object.freeze([
  { id: 'torso', label: 'torso', boneId: 'torso', parentBoneId: 'root', x: 0.5, y: 0.52, width: 0.3, height: 0.34, pivotX: 0.5, pivotY: 0.43, zIndex: 3 },
  { id: 'head', label: 'head and neck', boneId: 'head', parentBoneId: 'torso', x: 0.5, y: 0.28, width: 0.24, height: 0.24, pivotX: 0.5, pivotY: 0.34, zIndex: 6 },
  { id: 'arm-left-upper', label: 'left upper arm', boneId: 'arm-left-upper', parentBoneId: 'torso', x: 0.35, y: 0.4, width: 0.15, height: 0.23, pivotX: 0.37, pivotY: 0.39, zIndex: 2 },
  { id: 'arm-left-lower', label: 'left forearm and hand', boneId: 'arm-left-lower', parentBoneId: 'arm-left-upper', x: 0.29, y: 0.55, width: 0.14, height: 0.22, pivotX: 0.31, pivotY: 0.47, zIndex: 1 },
  { id: 'arm-right-upper', label: 'right upper arm', boneId: 'arm-right-upper', parentBoneId: 'torso', x: 0.65, y: 0.4, width: 0.15, height: 0.23, pivotX: 0.63, pivotY: 0.39, zIndex: 4 },
  { id: 'arm-right-lower', label: 'right forearm and hand', boneId: 'arm-right-lower', parentBoneId: 'arm-right-upper', x: 0.71, y: 0.55, width: 0.14, height: 0.22, pivotX: 0.69, pivotY: 0.47, zIndex: 5 },
  { id: 'leg-left-upper', label: 'left thigh', boneId: 'leg-left-upper', parentBoneId: 'root', x: 0.43, y: 0.7, width: 0.16, height: 0.24, pivotX: 0.44, pivotY: 0.65, zIndex: 2 },
  { id: 'leg-left-lower', label: 'left lower leg and foot', boneId: 'leg-left-lower', parentBoneId: 'leg-left-upper', x: 0.42, y: 0.87, width: 0.15, height: 0.22, pivotX: 0.43, pivotY: 0.82, zIndex: 1 },
  { id: 'leg-right-upper', label: 'right thigh', boneId: 'leg-right-upper', parentBoneId: 'root', x: 0.57, y: 0.7, width: 0.16, height: 0.24, pivotX: 0.56, pivotY: 0.65, zIndex: 4 },
  { id: 'leg-right-lower', label: 'right lower leg and foot', boneId: 'leg-right-lower', parentBoneId: 'leg-right-upper', x: 0.58, y: 0.87, width: 0.15, height: 0.22, pivotX: 0.57, pivotY: 0.82, zIndex: 3 }
]);

function stableSeed(characterId, appearance) {
  const source = key(characterId) + '|' + key(appearance);
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Build an explicit ten-part generation plan and an unbound rig scaffold.
 * This is preparation only: generated images must be reviewed and bound before animation.
 */
export function buildCharacterRigAssetPlan({ characterId, appearanceReference, identitySeed } = {}) {
  const id = clean(characterId, 120);
  const appearance = clean(appearanceReference, 1800);
  if (!id || !appearance) {
    return {
      status: 'blocked',
      issues: [!id ? 'character-id-missing' : null, !appearance ? 'appearance-reference-missing' : null].filter(Boolean),
      parts: [],
      rig: null
    };
  }
  const seed = Number.isInteger(identitySeed) && identitySeed >= 0 && identitySeed <= 0xffffffff
    ? identitySeed : stableSeed(id, appearance);
  const parts = PARTS.map((part, index) => ({
    assetId: 'rig:' + id + ':' + part.id,
    characterId: id,
    sceneId: '',
    assetRole: 'character-rig-part',
    partId: part.id,
    boneId: part.boneId,
    order: index,
    identitySeed: seed,
    width: 512,
    height: 512,
    status: 'ready',
    prompt: [
      'Create exactly one isolated transparent-background 2D cartoon character body-part sprite.',
      'Character ID: ' + id + '.',
      'Canonical character appearance; preserve species, proportions, face style, colors, clothing, materials and distinctive features exactly: ' + appearance + '.',
      'Draw only this body part: ' + part.label + '.',
      'Neutral anatomical rest pose, front three-quarter view, clean silhouette, centered, complete part visible.',
      'Include a small natural overlap area at the joint edges so adjacent parts can be composited without visible gaps.',
      'Do not draw the rest of the body, extra limbs, props, scenery, text, logos or watermarks.',
      'Transparent alpha background; one part only; consistent lighting and line style.'
    ].join(' '),
    negativePrompt: 'full body, extra body parts, duplicate limbs, background, scenery, text, logo, watermark, cropped joint, detached fingers, costume redesign',
    bone: {
      id: part.boneId,
      parentId: part.parentBoneId,
      pivotX: part.pivotX,
      pivotY: part.pivotY,
      pivotEnabled: true
    },
    placement: {
      x: part.x, y: part.y, width: part.width, height: part.height,
      rotation: 0, zIndex: part.zIndex
    }
  }));

  const bones = [
    { id: 'root', parentId: null, pivotX: 0.5, pivotY: 0.78, pivotEnabled: true },
    ...parts.map(part => ({ ...part.bone }))
  ];
  const rigParts = parts.map(part => ({
    id: part.partId,
    boneId: part.boneId,
    imageUrl: '',
    ...part.placement
  }));
  return {
    status: 'ready_for_generation',
    characterId: id,
    identitySeed: seed,
    parts,
    rig: { schemaVersion: 1, characterId: id, bones, parts: rigParts },
    verificationRequired: ['alpha-transparency', 'correct-body-part', 'character-identity', 'joint-alignment', 'anatomical-placement']
  };
}

export const CHARACTER_RIG_ASSET_PART_COUNT = PARTS.length;

import { verifySpriteTransparency } from './character-sprite-verification.js';
import { validateCharacterRig } from './character-rig.js';

export const CHARACTER_RIG_REQUIRED_PARTS = Object.freeze([
  'torso', 'head',
  'arm-left-upper', 'arm-left-lower',
  'arm-right-upper', 'arm-right-lower',
  'leg-left-upper', 'leg-left-lower',
  'leg-right-upper', 'leg-right-lower'
]);

const clean = (value, max = 160) => String(value ?? '').trim().slice(0, max);

/**
 * Review one generated rig part. Pixel alpha is measured automatically, while
 * semantic identity, correct anatomy and joint alignment require explicit human review.
 */
export function reviewCharacterRigPart(asset, imageData, width, height, decisions = {}) {
  if (!asset || typeof asset !== 'object') {
    return { status: 'unverified', approved: false, issues: ['asset-missing'], transparency: null };
  }
  const transparency = verifySpriteTransparency(imageData, width, height);
  const issues = [];
  if (!transparency.passed) issues.push('transparency-check-failed');
  if (decisions.correctPart !== true) issues.push('correct-body-part-not-confirmed');
  if (decisions.characterIdentity !== true) issues.push('character-identity-not-confirmed');
  if (decisions.jointAlignment !== true) issues.push('joint-alignment-not-confirmed');
  const approved = issues.length === 0;
  return {
    status: approved ? 'approved' : transparency.status === 'failed' ? 'rejected' : 'needs_review',
    approved,
    reviewedAt: approved ? new Date().toISOString() : null,
    decisions: {
      correctPart: decisions.correctPart === true,
      characterIdentity: decisions.characterIdentity === true,
      jointAlignment: decisions.jointAlignment === true
    },
    transparency,
    issues
  };
}

/**
 * Assemble only a complete, individually approved ten-part set.
 * This validates the rig structure and HTTPS image bindings, but cannot prove
 * that the human approvals were visually correct.
 */
export function assembleApprovedCharacterRig({ characterId, rig, assets, reviews } = {}) {
  const id = clean(characterId);
  if (!id || !rig || !Array.isArray(assets) || !Array.isArray(reviews)) {
    return { status: 'blocked', readyForAnimation: false, issues: ['incomplete-rig-input'], rig: null };
  }

  const byPart = new Map();
  for (const asset of assets) {
    const partId = clean(asset?.partId);
    if (!partId || byPart.has(partId)) {
      return { status: 'blocked', readyForAnimation: false, issues: ['missing-or-duplicate-part-id'], rig: null };
    }
    byPart.set(partId, asset);
  }
  const reviewByPart = new Map(reviews.map(item => [clean(item?.partId), item?.review]));
  const missing = CHARACTER_RIG_REQUIRED_PARTS.filter(partId => !byPart.has(partId));
  const unapproved = CHARACTER_RIG_REQUIRED_PARTS.filter(partId => reviewByPart.get(partId)?.approved !== true);
  if (missing.length || unapproved.length) {
    return {
      status: 'blocked',
      readyForAnimation: false,
      issues: [
        ...missing.map(partId => 'missing-part:' + partId),
        ...unapproved.map(partId => 'part-not-approved:' + partId)
      ],
      rig: null
    };
  }

  const rigParts = (Array.isArray(rig.parts) ? rig.parts : []).map(part => {
    const asset = byPart.get(clean(part?.id));
    return asset ? { ...part, imageUrl: clean(asset.imageUrl, 2048) } : part;
  });
  const report = validateCharacterRig({ ...rig, characterId: id, parts: rigParts });
  if (!report.passed) {
    return {
      status: 'invalid',
      readyForAnimation: false,
      issues: report.issues.map(issue => issue.code),
      rig: report.rig
    };
  }
  return {
    status: 'approved',
    readyForAnimation: true,
    issues: [],
    rig: report.rig,
    approvedPartCount: CHARACTER_RIG_REQUIRED_PARTS.length
  };
}

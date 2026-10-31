import { validateCharacterActionTimeline } from './character-action-timeline.js';

const MAX_SPRITES_PER_SCENE = 12;
const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);
const key = value => clean(value, 120).toLocaleLowerCase();

function profileAppearance(profile = {}) {
  return [
    profile.species, profile.ageRange, profile.visualDescription, profile.bodyShape,
    profile.hair, profile.eyeColor, profile.silhouette, profile.clothing,
    profile.colors, profile.signatureAccessories, profile.distinctiveFeatures
  ].map(value => clean(value, 700)).filter(Boolean).join(' — ');
}

function characterAction(scene, characterId, castSize) {
  if (scene.actionTimeline != null) {
    const report = validateCharacterActionTimeline(scene);
    if (!report.passed) return '';
    const phases = scene.actionTimeline.phases
      .filter(phase => key(phase.actorId) === key(characterId))
      .map(phase => clean(phase.description, 700))
      .filter(Boolean);
    return [...new Set(phases)].join(' ');
  }
  // A general action can be assigned safely only when the scene has one character.
  return castSize === 1 ? clean(scene.visibleAction, 1000) : '';
}

/**
 * Prepare one grounded sprite-generation request per scene character.
 * This is a local planning step only: it performs no network requests and creates no images.
 */
export function buildCharacterSpriteAssetPlan(scene = {}, characterBible = []) {
  const rawCast = Array.isArray(scene.characters) ? scene.characters : [];
  const cast = [];
  const seen = new Set();
  for (const value of rawCast) {
    const characterId = clean(value, 120);
    const idKey = key(characterId);
    if (!characterId || seen.has(idKey)) continue;
    seen.add(idKey);
    cast.push(characterId);
    if (cast.length >= MAX_SPRITES_PER_SCENE) break;
  }

  const profiles = new Map();
  for (const profile of Array.isArray(characterBible) ? characterBible : []) {
    const idKey = key(profile?.characterId);
    if (idKey && !profiles.has(idKey)) profiles.set(idKey, profile);
  }

  return cast.map((characterId, index) => {
    const profile = profiles.get(key(characterId));
    const appearance = profile ? profileAppearance(profile) : '';
    const action = characterAction(scene, characterId, cast.length);
    const issues = [];
    if (!profile) issues.push({ code: 'missing-character-reference', characterId });
    else if (!appearance) issues.push({ code: 'empty-character-appearance', characterId });
    if (!action) issues.push({ code: 'missing-character-action', characterId });

    const prompt = appearance && [
      'Create one isolated full-body character sprite for a 2D/2.5D animated cartoon scene.',
      `Stable character ID: ${characterId}.`,
      `Canonical appearance (must remain unchanged): ${appearance}.`,
      action && `Pose and action for this scene only: ${action}.`,
      clean(scene.location, 300) && `Scene setting context: ${clean(scene.location, 300)}.`,
      clean(scene.timeOfDay, 120) && `Lighting context: ${clean(scene.timeOfDay, 120)}.`,
      'Show the complete character, including feet/paws, with a clean silhouette. Transparent background, no scenery, no text, no logo, no watermark.',
      'Do not redesign the character, change clothing or colors, add accessories, or invent props. Preserve the canonical reference.'
    ].filter(Boolean).join(' ');

    return {
      assetId: `${clean(scene.id, 120) || 'scene'}:${characterId}`,
      sceneId: clean(scene.id, 120),
      characterId,
      order: index,
      assetRole: 'character-sprite',
      transparentBackground: true,
      appearanceReference: appearance,
      action,
      prompt,
      negativePrompt: 'background, scenery, extra characters, cropped body, missing feet, text, logo, watermark, costume change, different colors, duplicate limbs',
      status: issues.length ? 'blocked' : 'ready',
      issues
    };
  });
}

export const CHARACTER_SPRITE_SCENE_LIMIT = MAX_SPRITES_PER_SCENE;

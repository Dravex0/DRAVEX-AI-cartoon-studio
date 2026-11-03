import { generateImageWithHorde } from './ai-horde-image-provider.js';
import { buildCharacterRigAssetPlan } from './character-rig-asset-plan.js';

const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);

/**
 * Generate isolated rig-part images in a deterministic sequence.
 * Each result remains an unverified preview until alpha, identity and joint placement
 * have been inspected. This function never attaches parts to a scene or marks a rig valid.
 */
export async function generateCharacterRigParts({
  characterId,
  appearanceReference,
  identitySeed,
  consentAccepted = false,
  generateImage = generateImageWithHorde,
  signal,
  onProgress,
  width = 512,
  height = 512,
  steps = 20
} = {}) {
  if (consentAccepted !== true) {
    throw new Error('Explicit consent is required before sending character rig prompts to AI Horde.');
  }
  const plan = buildCharacterRigAssetPlan({ characterId, appearanceReference, identitySeed });
  if (plan.status !== 'ready_for_generation') {
    throw new Error('A character ID and canonical appearance reference are required.');
  }

  const assets = [];
  const failures = [];
  let cancelled = false;
  for (let index = 0; index < plan.parts.length; index++) {
    if (signal?.aborted) { cancelled = true; break; }
    const part = plan.parts[index];
    onProgress?.({ phase: 'generating', index: index + 1, total: plan.parts.length, partId: part.partId });
    try {
      const result = await generateImage({
        prompt: part.prompt,
        negativePrompt: part.negativePrompt,
        width,
        height,
        steps,
        seed: plan.identitySeed,
        signal,
        onProgress: progress => onProgress?.({
          phase: 'queue',
          index: index + 1,
          total: plan.parts.length,
          partId: part.partId,
          queue: progress
        })
      });
      let parsed;
      try { parsed = new URL(String(result?.imageUrl ?? '')); } catch {}
      if (parsed?.protocol !== 'https:') {
        throw new Error('Image provider returned an unsupported image URL.');
      }
      assets.push({
        assetId: part.assetId,
        characterId: plan.characterId,
        assetRole: 'character-rig-part',
        partId: part.partId,
        boneId: part.boneId,
        imageUrl: parsed.href,
        provider: 'ai-horde',
        requestId: clean(result?.requestId, 80),
        seed: clean(result?.seed, 80),
        identitySeed: plan.identitySeed,
        model: clean(result?.model, 120),
        generationStatus: 'generated',
        verificationStatus: 'not_verified',
        transparencyStatus: 'unverified',
        visualIdentityStatus: 'not_verified',
        jointAlignmentStatus: 'not_verified',
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') { cancelled = true; break; }
      failures.push({ partId: part.partId, message: clean(error?.message || 'Generation failed.', 300) });
    }
    onProgress?.({
      phase: 'part-complete',
      index: index + 1,
      total: plan.parts.length,
      partId: part.partId,
      completed: assets.length,
      failed: failures.length
    });
  }

  return {
    status: cancelled ? 'cancelled' : failures.length === 0 ? 'generated_unverified' : assets.length ? 'partially_generated' : 'failed',
    cancelled,
    characterId: plan.characterId,
    identitySeed: plan.identitySeed,
    assets,
    failures,
    rig: plan.rig,
    verificationRequired: [...plan.verificationRequired],
    readyForAnimation: false
  };
}

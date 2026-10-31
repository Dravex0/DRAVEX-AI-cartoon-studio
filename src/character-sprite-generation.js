import { generateImageWithHorde } from './ai-horde-image-provider.js';

const clean = (value, max = 120) => String(value ?? '').trim().slice(0, max);

/**
 * Generate one character sprite only after a separate, explicit sprite-prompt consent.
 * The returned image is not assumed to have an alpha channel; callers must inspect it.
 */
export async function generateCharacterSpriteAsset({
  plan,
  consentAccepted = false,
  generateImage = generateImageWithHorde,
  signal,
  onProgress,
  width = 512,
  height = 768,
  steps = 20
} = {}) {
  if (consentAccepted !== true) {
    throw new Error('Explicit character-sprite prompt consent is required before sending anything to AI Horde.');
  }
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new Error('A character sprite plan is required.');
  }
  const characterId = clean(plan.characterId);
  const assetId = clean(plan.assetId, 240);
  const prompt = String(plan.prompt ?? '').trim().slice(0, 10000);
  const planningStatus = plan.planningStatus ?? plan.status;
  if (planningStatus !== 'ready' || !characterId || !assetId || !prompt) {
    throw new Error('The character sprite plan is blocked or incomplete.');
  }

  const result = await generateImage({
    prompt,
    negativePrompt: String(plan.negativePrompt ?? '').trim().slice(0, 2000),
    width,
    height,
    steps,
    signal,
    onProgress
  });
  let parsed;
  try { parsed = new URL(String(result?.imageUrl ?? '')); } catch {}
  if (parsed?.protocol !== 'https:') {
    throw new Error('The image provider returned an unsupported image URL.');
  }

  return {
    assetId,
    sceneId: clean(plan.sceneId),
    characterId,
    assetRole: 'character-sprite',
    imageUrl: parsed.href,
    provider: 'ai-horde',
    requestId: clean(result?.requestId, 80),
    seed: clean(result?.seed, 80),
    model: clean(result?.model, 120),
    generationStatus: 'generated',
    verificationStatus: 'not_verified',
    transparencyStatus: 'unverified',
    visualIdentityStatus: 'not_verified',
    generatedAt: new Date().toISOString()
  };
}

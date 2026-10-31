import { generateImageWithHorde } from './ai-horde-image-provider.js';

const clean = (value, max = 120) => String(value ?? '').trim().slice(0, max);

/**
 * Generate an environment-only background plate after explicit consent.
 * A negative prompt and a separated prompt reduce risk but do not prove the
 * returned image contains no characters; composition remains unverified.
 */
export async function generateSceneBackgroundAsset({
  plan,
  sceneId = '',
  consentAccepted = false,
  generateImage = generateImageWithHorde,
  signal,
  onProgress,
  width = 768,
  height = 512,
  steps = 20
} = {}) {
  if (consentAccepted !== true) {
    throw new Error('Explicit scene-background prompt consent is required before sending anything to AI Horde.');
  }
  if (!plan || typeof plan !== 'object' || Array.isArray(plan) || plan.ready !== true ||
      plan.assetRole !== 'scene-background' || !String(plan.prompt ?? '').trim()) {
    throw new Error('A ready scene-background prompt plan is required.');
  }

  const result = await generateImage({
    prompt: String(plan.prompt).trim().slice(0, 10000),
    negativePrompt: 'people, characters, animals, creatures, figures, silhouettes, portraits, character-shaped shadows, foreground subjects, text, captions, logos, watermarks',
    width,
    height,
    steps,
    signal,
    onProgress
  });
  let parsed;
  try { parsed = new URL(String(result?.imageUrl ?? '')); } catch {}
  if (parsed?.protocol !== 'https:') {
    throw new Error('The image provider returned an unsupported background image URL.');
  }

  return {
    assetId: clean(plan.assetId, 240) || 'background-' + clean(sceneId, 120),
    sceneId: clean(sceneId || plan.sceneId),
    assetRole: 'scene-background',
    imageUrl: parsed.href,
    provider: 'ai-horde',
    requestId: clean(result?.requestId, 80),
    seed: clean(result?.seed, 80),
    model: clean(result?.model, 120),
    compositionStatus: 'unverified',
    generatedAt: new Date().toISOString()
  };
}

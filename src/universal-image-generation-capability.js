import { resolveUniversalVoiceTargets } from './universal-voice-target.js';

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

function abortError() {
  const error = new Error('Universal scene image generation was cancelled.');
  error.name = 'AbortError';
  return error;
}

function fingerprint(scene) {
  return JSON.stringify({
    id: clean(scene?.id, 120),
    title: clean(scene?.title, 200),
    description: clean(scene?.description, 1200),
    storyDetail: clean(scene?.storyDetail, 1200),
    visibleAction: clean(scene?.visibleAction, 1000),
    prompt: clean(scene?.prompt, 1200),
    imagePrompt: clean(scene?.imagePrompt, 1200),
    negativePrompt: clean(scene?.negativePrompt, 500),
    characters: Array.isArray(scene?.characters) ? scene.characters.map(value => clean(value, 120)).slice(0, 20) : []
  });
}

/**
 * Explicitly consented AI Horde still-image generation for one scene or a
 * sequential all-scenes batch. Existing scene images are never overwritten.
 */
export function createUniversalImageGenerationCapability({
  getScenes = () => [],
  isImageReady = scene => Boolean(clean(scene?.generatedImageUrl, 5000)),
  generateSceneImage,
  onSceneGenerated
} = {}) {
  if (typeof getScenes !== 'function') throw new TypeError('getScenes must be a function.');
  if (typeof isImageReady !== 'function') throw new TypeError('isImageReady must be a function.');
  if (typeof generateSceneImage !== 'function') throw new TypeError('generateSceneImage must be a function.');
  if (typeof onSceneGenerated !== 'function') throw new TypeError('onSceneGenerated must be a function.');

  function resolve(step) {
    const scenes = getScenes();
    if (!Array.isArray(scenes) || scenes.length === 0) return { ok: false, reason: 'no-scenes-available' };
    if (!step) return { ok: true, allScenes: true, indices: scenes.map((_, index) => index) };
    return resolveUniversalVoiceTargets(step, scenes, 0);
  }

  function isAvailable({ step } = {}) {
    try {
      const scenes = getScenes();
      const targets = resolve(step);
      return targets.ok && targets.indices.some(index => !isImageReady(scenes[index]));
    } catch { return false; }
  }

  return Object.freeze({
    id: 'image.generate.horde',
    name: 'Generate missing storyboard scene images with AI Horde',
    privacy: 'remote',
    consentKey: 'ai-horde-image',
    isAvailable,
    async run({ plan, step, signal, reportProgress } = {}) {
      if (signal?.aborted) throw abortError();
      if (!/(image|visual|scene|video|film|movie|animation|cartoon|изображ|зображ|картин|малюн|сцен|видео|відео|фильм|фільм|мульт|анимац|анімац)/i.test(clean(plan?.sourceRequest, 12000))) {
        const error = new Error('Scene image generation only accepts explicit image, scene, video, or film requests.');
        error.code = 'CAPABILITY_REQUEST_MISMATCH';
        throw error;
      }
      if (!step || !Array.isArray(step.requiredCapabilities) ||
          step.requiredCapabilities.length !== 1 || step.requiredCapabilities[0] !== 'image.generate.horde') {
        const error = new Error('Scene image generation requires one explicit image.generate.horde capability.');
        error.code = 'CAPABILITY_BINDING_MISMATCH';
        throw error;
      }
      const scenes = getScenes();
      const targets = resolve(step);
      if (!targets.ok) {
        const error = new Error('Could not resolve scene image target: ' + targets.reason + '.');
        error.code = 'IMAGE_SCENE_TARGET_INVALID';
        throw error;
      }
      const initialIds = scenes.map(scene => clean(scene?.id, 120));
      if (initialIds.some(id => !id) || new Set(initialIds).size !== initialIds.length) {
        const error = new Error('Storyboard scenes need unique stable IDs before image generation.');
        error.code = 'IMAGE_SCENE_IDS_INVALID';
        throw error;
      }
      const targetScenes = targets.indices
        .filter(index => !isImageReady(scenes[index]))
        .map(index => ({
          sceneId: clean(scenes[index]?.id, 120),
          originalIndex: index,
          scene: { ...scenes[index] },
          fingerprint: fingerprint(scenes[index])
        }));
      if (!targetScenes.length) {
        const error = new Error('No storyboard scenes need a new image; existing images were preserved.');
        error.code = 'SCENE_IMAGES_ALREADY_READY';
        throw error;
      }

      const generated = [];
      for (let position = 0; position < targetScenes.length; position += 1) {
        if (signal?.aborted) throw abortError();
        const target = targetScenes[position];
        const currentScenes = getScenes();
        const currentIndex = currentScenes.findIndex(scene => clean(scene?.id, 120) === target.sceneId);
        if (currentIndex < 0) throw new Error('Scene ' + (target.originalIndex + 1) + ' was removed during image generation.');
        if (isImageReady(currentScenes[currentIndex])) continue;
        if (fingerprint(currentScenes[currentIndex]) !== target.fingerprint) {
          throw new Error('Scene ' + (target.originalIndex + 1) + ' changed during image generation; stale output was not attached.');
        }
        reportProgress?.('Generating image for scene ' + (currentIndex + 1) + ' · ' + (position + 1) + ' / ' + targetScenes.length);
        const result = await generateSceneImage({
          scene: target.scene,
          sceneIndex: target.originalIndex,
          signal,
          reportProgress: detail => reportProgress?.(String(detail ?? '').slice(0, 400))
        });
        if (signal?.aborted) throw abortError();
        const imageUrl = clean(result?.imageUrl, 5000);
        if (!/^https:\/\//i.test(imageUrl)) {
          const error = new Error('AI Horde did not return a valid HTTPS scene image.');
          error.code = 'INVALID_SCENE_IMAGE';
          throw error;
        }
        const latestScenes = getScenes();
        const resolvedIndex = latestScenes.findIndex(scene => clean(scene?.id, 120) === target.sceneId);
        if (resolvedIndex < 0) throw new Error('Scene ' + (target.originalIndex + 1) + ' was removed before its image could be attached.');
        if (isImageReady(latestScenes[resolvedIndex])) continue;
        if (fingerprint(latestScenes[resolvedIndex]) !== target.fingerprint) {
          throw new Error('Scene ' + (target.originalIndex + 1) + ' changed while AI Horde was working; the stale image was discarded.');
        }
        await onSceneGenerated({ scene: latestScenes[resolvedIndex], sceneIndex: resolvedIndex, result });
        const afterScenes = getScenes();
        if (!isImageReady(afterScenes.find(scene => clean(scene?.id, 120) === target.sceneId))) {
          throw new Error('The generated scene image was not saved to its storyboard scene.');
        }
        generated.push({
          sceneId: target.sceneId,
          imageUrl,
          seed: clean(result?.seed, 80),
          model: clean(result?.model, 120),
          workerName: clean(result?.workerName, 120),
          shared: result?.shared !== false
        });
      }
      if (targets.allScenes) {
        const finalScenes = getScenes();
        const finalIds = finalScenes.map(scene => clean(scene?.id, 120));
        const expected = new Set(initialIds);
        if (finalIds.length !== expected.size || finalIds.some(id => !expected.has(id))) {
          throw new Error('The storyboard changed during all-scene image generation; review completed scene images before continuing.');
        }
        const missing = finalScenes.map((scene, index) => isImageReady(scene) ? null : index + 1).filter(Boolean);
        if (missing.length) throw new Error('Image generation is incomplete for scene(s): ' + missing.join(', ') + '.');
      }
      return {
        type: 'scene-images',
        sceneIds: generated.map(item => item.sceneId),
        imageCount: generated.length,
        allScenes: targets.allScenes === true,
        shared: generated.some(item => item.shared),
        remote: true
      };
    }
  });
}

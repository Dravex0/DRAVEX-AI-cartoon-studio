const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

function abortError() {
  const error = new Error('Video generation was cancelled.');
  error.name = 'AbortError';
  return error;
}

/**
 * App-owned bridge from the universal executor to one real, configured local
 * scene-video workflow. The application injects the existing provider and
 * persistence implementation; this module never invents a provider or uploads
 * assets on its own.
 */
export function createUniversalLocalVideoCapability({
  isAvailable = () => false,
  generateScene
} = {}) {
  if (typeof isAvailable !== 'function') throw new TypeError('isAvailable must be a function.');
  if (typeof generateScene !== 'function') throw new TypeError('generateScene must be a function.');

  return Object.freeze({
    id: 'video.generate.local',
    name: 'Generate a scene video with local ComfyUI',
    privacy: 'local',
    isAvailable,
    async run({ plan, step, signal, reportProgress } = {}) {
      if (signal?.aborted) throw abortError();
      if (!/(video|film|movie|clip|animation|cartoon|видео|ролик|мульт|анімац|сцен)/i.test(clean(plan?.sourceRequest, 12000))) {
        const error = new Error('The local video adapter only accepts explicit video, film, animation, or scene requests.');
        error.code = 'CAPABILITY_REQUEST_MISMATCH';
        throw error;
      }
      if (!step || !Array.isArray(step.requiredCapabilities) ||
          step.requiredCapabilities.length !== 1 ||
          step.requiredCapabilities[0] !== 'video.generate.local') {
        const error = new Error('The video adapter requires one explicit video.generate.local capability.');
        error.code = 'CAPABILITY_BINDING_MISMATCH';
        throw error;
      }
      if (!isAvailable({ plan, step })) {
        const error = new Error('Local ComfyUI video generation is not ready. Connect ComfyUI and prepare a scene image first.');
        error.code = 'CAPABILITY_UNAVAILABLE';
        throw error;
      }
      reportProgress?.('Starting local scene video generation');
      const result = await generateScene({ plan, step, signal, reportProgress });
      if (signal?.aborted) throw abortError();
      if (!result || result.status !== 'completed' || !clean(result.sceneId, 120) ||
          !clean(result.filename, 180) || !(Number(result.size) > 0)) {
        const error = new Error('The local video workflow did not return a verified scene-video artifact.');
        error.code = 'INVALID_VIDEO_ARTIFACT';
        throw error;
      }
      return {
        type: 'scene-video',
        sceneId: clean(result.sceneId, 120),
        filename: clean(result.filename, 180),
        mimeType: clean(result.mimeType, 80) || 'application/octet-stream',
        size: Math.floor(Number(result.size)),
        persisted: result.persisted === true
      };
    }
  });
}

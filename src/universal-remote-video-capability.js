const clean = (value, max = 12_000) => String(value ?? '').trim().slice(0, max);

function abortError() {
  const error = new Error('Remote video generation was cancelled.');
  error.name = 'AbortError';
  return error;
}

/**
 * Explicit-consent bridge to an app-owned remote scene-video generator.
 * The registry enforces consent too; this adapter repeats the check directly
 * before invoking the upload-capable application callback.
 */
export function createUniversalRemoteVideoCapability({
  isAvailable = () => false,
  hasConsent = () => false,
  generateScene
} = {}) {
  if (typeof isAvailable !== 'function' || typeof hasConsent !== 'function') {
    throw new TypeError('Remote video availability and consent checks must be functions.');
  }
  if (typeof generateScene !== 'function') throw new TypeError('generateScene must be a function.');

  return Object.freeze({
    id: 'video.generate.remote',
    name: 'Generate a scene video with Hugging Face Wan 2.2',
    privacy: 'remote',
    requiresConsent: true,
    isAvailable,
    async run({ plan, step, signal, reportProgress } = {}) {
      if (signal?.aborted) throw abortError();
      if (!hasConsent()) {
        const error = new Error('Remote upload consent is not currently enabled.');
        error.code = 'REMOTE_CONSENT_REQUIRED';
        throw error;
      }
      if (!/(video|film|movie|clip|animation|cartoon|видео|ролик|мульт|анімац|сцен)/i.test(clean(plan?.sourceRequest))) {
        const error = new Error('The remote video adapter only accepts explicit video, film, animation, or scene requests.');
        error.code = 'CAPABILITY_REQUEST_MISMATCH';
        throw error;
      }
      if (!step || !Array.isArray(step.requiredCapabilities) ||
          step.requiredCapabilities.length !== 1 ||
          step.requiredCapabilities[0] !== 'video.generate.remote') {
        const error = new Error('The remote video adapter requires one explicit video.generate.remote capability.');
        error.code = 'CAPABILITY_BINDING_MISMATCH';
        throw error;
      }
      if (!isAvailable({ plan, step })) {
        const error = new Error('Hugging Face Wan 2.2 is not connected or the selected scene is not ready.');
        error.code = 'CAPABILITY_UNAVAILABLE';
        throw error;
      }
      reportProgress?.('Preparing explicit-consent remote scene generation');
      const result = await generateScene({ plan, step, signal, reportProgress, hasConsent });
      if (signal?.aborted) throw abortError();
      if (!result || result.status !== 'completed' || !clean(result.sceneId, 120) ||
          !clean(result.filename, 180) || !(Number(result.size) > 0)) {
        const error = new Error('The remote video workflow did not return a verified scene-video artifact.');
        error.code = 'INVALID_VIDEO_ARTIFACT';
        throw error;
      }
      return {
        type: 'scene-video',
        sceneId: clean(result.sceneId, 120),
        filename: clean(result.filename, 180),
        mimeType: clean(result.mimeType, 80) || 'application/octet-stream',
        size: Math.floor(Number(result.size)),
        persisted: result.persisted === true,
        provider: 'huggingface-wan22'
      };
    }
  });
}

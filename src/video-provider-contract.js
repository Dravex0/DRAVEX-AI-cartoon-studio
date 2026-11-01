export const VIDEO_TASK_TYPES = Object.freeze(['text-to-video', 'image-to-video', 'video-to-video']);
export const VIDEO_DURATION_MIN = 0.25;
export const VIDEO_DURATION_MAX = 30;

const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const finite = value => {
  try {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  } catch {
    return null;
  }
};

export function validateVideoGenerationRequest(input = {}) {
  const issues = [];
  const taskType = text(input.taskType, 40);
  const prompt = text(input.prompt);
  const durationSeconds = finite(input.durationSeconds);
  const fps = finite(input.fps ?? 24);
  const image = input.image ?? null;
  const video = input.video ?? null;

  if (!VIDEO_TASK_TYPES.includes(taskType)) issues.push({ code: 'unsupported-task-type', field: 'taskType' });
  if (!prompt) issues.push({ code: 'missing-prompt', field: 'prompt' });
  if (durationSeconds === null || durationSeconds < VIDEO_DURATION_MIN || durationSeconds > VIDEO_DURATION_MAX) {
    issues.push({ code: 'invalid-duration', field: 'durationSeconds' });
  }
  if (fps === null || fps < 1 || fps > 60) issues.push({ code: 'invalid-fps', field: 'fps' });
  if (taskType === 'image-to-video' && !image) {
    issues.push({ code: 'missing-source-media', field: 'image' });
  }
  if (taskType === 'video-to-video' && !video) {
    issues.push({ code: 'missing-source-media', field: 'video' });
  }

  return {
    valid: issues.length === 0,
    issues,
    value: issues.length === 0 ? {
      taskType,
      prompt,
      negativePrompt: text(input.negativePrompt, 2000),
      durationSeconds,
      fps,
      aspectRatio: text(input.aspectRatio, 20) || 'source',
      image: taskType === 'image-to-video' ? image : null,
      video: taskType === 'video-to-video' ? video : null,
      seed: Number.isInteger(input.seed) && input.seed >= 0 ? input.seed : null
    } : null
  };
}

function normalizeProvider(provider) {
  if (!provider || typeof provider !== 'object') throw new TypeError('A video provider object is required.');
  const id = text(provider.id, 80);
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id)) throw new TypeError('Provider id must be a short identifier.');
  if (typeof provider.generate !== 'function') throw new TypeError('Provider must implement generate(request, context).');
  const taskTypes = Array.isArray(provider.taskTypes)
    ? [...new Set(provider.taskTypes.filter(type => VIDEO_TASK_TYPES.includes(type)))]
    : [];
  if (!taskTypes.length) throw new TypeError('Provider must declare at least one supported task type.');
  return Object.freeze({
    id,
    name: text(provider.name, 120) || id,
    taskTypes: Object.freeze(taskTypes),
    local: provider.local === true,
    requiresUserKey: provider.requiresUserKey === true,
    generate: provider.generate
  });
}

/** Small registry: provider modules opt in explicitly; no API is called during registration. */
export function createVideoProviderRegistry() {
  const providers = new Map();
  return Object.freeze({
    register(provider) {
      const normalized = normalizeProvider(provider);
      if (providers.has(normalized.id)) throw new Error(`Video provider "${normalized.id}" is already registered.`);
      providers.set(normalized.id, normalized);
      return normalized;
    },
    get(id) {
      return providers.get(text(id, 80)) ?? null;
    },
    list() {
      return [...providers.values()].map(({ id, name, taskTypes, local, requiresUserKey }) => ({
        id, name, taskTypes: [...taskTypes], local, requiresUserKey
      }));
    },
    remove(id) {
      return providers.delete(text(id, 80));
    }
  });
}

export async function generateVideoWithProvider(registry, providerId, input, context = {}) {
  const provider = registry?.get?.(providerId);
  if (!provider) throw new Error('Video provider is not registered.');
  const validation = validateVideoGenerationRequest(input);
  if (!validation.valid) {
    const error = new Error('Video generation request is invalid.');
    error.code = 'INVALID_VIDEO_REQUEST';
    error.issues = validation.issues;
    throw error;
  }
  if (!provider.taskTypes.includes(validation.value.taskType)) {
    const error = new Error(`Provider "${provider.id}" does not support ${validation.value.taskType}.`);
    error.code = 'UNSUPPORTED_VIDEO_TASK';
    throw error;
  }
  if (context.signal?.aborted) {
    const error = new Error('Video generation was cancelled before it started.');
    error.name = 'AbortError';
    throw error;
  }
  const result = await provider.generate(validation.value, context);
  if (!result || typeof result !== 'object') throw new Error('Video provider returned an invalid result.');
  const status = text(result.status, 30) || (result.video || result.url ? 'completed' : 'pending');
  if (!['queued', 'processing', 'pending', 'completed', 'failed'].includes(status)) {
    throw new Error('Video provider returned an unsupported job status.');
  }
  if (status === 'completed' && !result.video && !result.url) {
    throw new Error('Completed video provider result must include a video Blob or URL.');
  }
  return {
    providerId: provider.id,
    status,
    taskId: text(result.taskId, 200),
    video: result.video ?? null,
    url: text(result.url, 2000),
    error: status === 'failed' ? text(result.error, 1000) : ''
  };
}

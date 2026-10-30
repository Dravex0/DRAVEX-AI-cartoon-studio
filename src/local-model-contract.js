export const LOCAL_MODEL_BACKENDS = Object.freeze(['webgpu', 'wasm']);
export const LOCAL_MODEL_TASKS = Object.freeze([
  'story-planning',
  'scene-directing',
  'character-memory',
  'dialogue-writing',
  'animation-planning',
  'audio-planning'
]);

const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const finitePositive = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
const abortError = () => {
  const error = new Error('Local model inference was cancelled.');
  error.name = 'AbortError';
  return error;
};

/** Validate metadata for an explicitly local model package. */
export function validateLocalModelManifest(input = {}) {
  const manifest = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const issues = [];
  const id = clean(manifest.id, 80);
  const version = clean(manifest.version, 40);
  const backend = clean(manifest.backend, 20);
  const license = clean(manifest.license, 120);
  const tasks = Array.isArray(manifest.tasks)
    ? [...new Set(manifest.tasks.filter(task => LOCAL_MODEL_TASKS.includes(task)))]
    : [];
  const modelSizeBytes = finitePositive(manifest.modelSizeBytes);
  const minMemoryGB = finitePositive(manifest.minMemoryGB);

  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id)) issues.push({ code: 'invalid-model-id', field: 'id' });
  if (!version) issues.push({ code: 'missing-model-version', field: 'version' });
  if (!LOCAL_MODEL_BACKENDS.includes(backend)) issues.push({ code: 'unsupported-local-backend', field: 'backend' });
  if (manifest.localOnly !== true) issues.push({ code: 'model-not-declared-local-only', field: 'localOnly' });
  if (!license) issues.push({ code: 'missing-license', field: 'license' });
  if (!tasks.length) issues.push({ code: 'missing-supported-tasks', field: 'tasks' });
  if (modelSizeBytes === null) issues.push({ code: 'invalid-model-size', field: 'modelSizeBytes' });

  const files = Array.isArray(manifest.files) ? manifest.files.map(file => ({
    path: clean(file?.path, 500),
    sizeBytes: finitePositive(file?.sizeBytes),
    sha256: clean(file?.sha256, 64).toLowerCase()
  })) : [];
  if (!files.length || files.some(file => !file.path || file.sizeBytes === null || file.path.startsWith('/') || file.path.split(/[\\\\/]+/).includes('..'))) {
    issues.push({ code: 'invalid-model-files', field: 'files' });
  }
  if (files.some(file => !/^[a-f0-9]{64}$/.test(file.sha256))) {
    issues.push({ code: 'invalid-file-checksum', field: 'files.sha256' });
  }

  return {
    valid: issues.length === 0,
    issues,
    value: issues.length === 0 ? Object.freeze({
      id, version, backend, license, localOnly: true, tasks: Object.freeze(tasks),
      modelSizeBytes, minMemoryGB, files: Object.freeze(files.map(file => Object.freeze(file)))
    }) : null
  };
}

/**
 * Advisory device fit check. A passing result is not proof that inference will fit or be fast.
 */
export function assessLocalModelFit(manifestInput, capabilities = {}) {
  const validation = validateLocalModelManifest(manifestInput);
  if (!validation.valid) {
    return { status: 'invalid-manifest', issues: validation.issues, canAttempt: false };
  }
  const model = validation.value;
  const issues = [];
  if (model.backend === 'webgpu' && capabilities.adapterAvailable !== true) {
    issues.push({ code: 'webgpu-adapter-unavailable' });
  }
  if (model.backend === 'wasm' && capabilities.wasmAvailable === false) {
    issues.push({ code: 'wasm-unavailable' });
  }
  const memoryGB = finitePositive(capabilities.deviceMemoryGB);
  if (model.minMemoryGB !== null && memoryGB !== null && memoryGB < model.minMemoryGB) {
    issues.push({ code: 'insufficient-device-memory', requiredGB: model.minMemoryGB, availableGB: memoryGB });
  }
  const storageBytes = finitePositive(capabilities.storage?.availableBytes);
  if (storageBytes !== null && storageBytes < model.modelSizeBytes) {
    issues.push({ code: 'insufficient-storage', requiredBytes: model.modelSizeBytes, availableBytes: storageBytes });
  }
  const hardBlock = issues.some(issue => [
    'webgpu-adapter-unavailable', 'wasm-unavailable', 'insufficient-device-memory', 'insufficient-storage'
  ].includes(issue.code));
  const unknown = (model.minMemoryGB !== null && memoryGB === null) || storageBytes === null;
  return {
    status: hardBlock ? 'not-recommended' : unknown ? 'unknown' : 'eligible-to-test',
    issues,
    canAttempt: !hardBlock,
    warning: 'Device estimates are advisory; run a small test before loading a full model.'
  };
}

/**
 * Create a local-only adapter around a trusted inference runner (for example, a WebGPU/WASM worker).
 * The runner must execute locally and must not forward prompts or user data to a cloud service.
 * This contract does not sandbox or independently verify third-party runner code.
 */
export function createLocalModelAdapter({ manifest: manifestInput, runner } = {}) {
  const validation = validateLocalModelManifest(manifestInput);
  if (!validation.valid) {
    const error = new TypeError('Local model manifest is invalid.');
    error.issues = validation.issues;
    throw error;
  }
  if (typeof runner !== 'function') throw new TypeError('A local inference runner function is required.');
  const manifest = validation.value;

  return Object.freeze({
    id: manifest.id,
    version: manifest.version,
    backend: manifest.backend,
    local: true,
    tasks: manifest.tasks,
    async generate(request = {}, context = {}) {
      const task = clean(request.task, 80);
      const prompt = clean(request.prompt, 30000);
      if (!manifest.tasks.includes(task)) throw new Error('The local model does not support this task.');
      if (!prompt) throw new TypeError('A prompt is required for local inference.');
      if (context.signal?.aborted) throw abortError();

      const raw = await runner({
        task,
        prompt,
        structuredInput: request.structuredInput ?? null,
        outputFormat: request.outputFormat === 'json' ? 'json' : 'text',
        maxTokens: Math.max(16, Math.min(8192, Math.round(Number(request.maxTokens) || 1024))),
        temperature: Math.max(0, Math.min(2, Number.isFinite(Number(request.temperature)) ? Number(request.temperature) : 0.2))
      }, { signal: context.signal, onProgress: context.onProgress ?? (() => {}) });

      if (context.signal?.aborted) throw abortError();
      const text = typeof raw === 'string' ? raw : clean(raw?.text, 100000);
      if (!text) throw new Error('The local model returned an empty response.');
      let data = null;
      if (request.outputFormat === 'json') {
        try { data = JSON.parse(text); }
        catch { throw new Error('The local model did not return valid JSON.'); }
      }
      return { providerId: manifest.id, modelVersion: manifest.version, local: true, text, data };
    }
  });
}

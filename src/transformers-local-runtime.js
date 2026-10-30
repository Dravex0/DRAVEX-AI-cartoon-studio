import { detectDeviceCapabilities } from './device-capabilities.js';

export const DEFAULT_LOCAL_TEXT_MODEL = Object.freeze({
  id: 'onnx-community/SmolLM2-135M-Instruct-ONNX',
  task: 'text-generation',
  suggestedWebGPUPrecision: 'q4f16',
  suggestedWasmPrecision: 'q4',
  approximateWebGPUWeightSizeBytes: 117 * 1024 * 1024,
  downloadSource: 'Hugging Face model repository',
  inferenceMode: 'on-device'
});

const abortError = () => {
  const error = new Error('Local model operation was cancelled.');
  error.name = 'AbortError';
  return error;
};

function assertNotAborted(signal) {
  if (signal?.aborted) throw abortError();
}

function safeProgress(callback, info) {
  if (typeof callback !== 'function') return;
  const event = {
    status: String(info?.status || 'progress').slice(0, 40),
    file: String(info?.file || '').slice(-120),
    loaded: Number.isFinite(info?.loaded) ? info.loaded : null,
    total: Number.isFinite(info?.total) ? info.total : null,
    progress: Number.isFinite(info?.progress) ? Math.max(0, Math.min(1, info.progress)) : null
  };
  try { callback(event); } catch { /* UI progress callbacks must not break model loading. */ }
}

async function defaultPipelineFactory(...args) {
  const transformers = await import('@huggingface/transformers');
  if (typeof transformers.pipeline !== 'function') {
    throw new Error('Transformers.js pipeline API is unavailable.');
  }
  return transformers.pipeline(...args);
}

/**
 * Lazy, opt-in Transformers.js runtime.
 * Model weights are downloaded from the declared Hugging Face repository on first load;
 * text generation runs in this browser through ONNX Runtime Web (WebGPU or WASM).
 * This module does not call a hosted inference API or transmit prompts to a provider.
 */
export function createLocalTransformersRuntime({
  environment = globalThis,
  pipelineFactory = defaultPipelineFactory
} = {}) {
  let pipe = null;
  let activeModelId = null;
  let activeBackend = null;
  let loading = null;
  let loadingKey = null;

  return Object.freeze({
    get status() {
      return {
        loaded: Boolean(pipe),
        modelId: activeModelId,
        backend: activeBackend,
        localInference: true
      };
    },

    async load({
      modelId = DEFAULT_LOCAL_TEXT_MODEL.id,
      backend = 'auto',
      onProgress,
      signal
    } = {}) {
      assertNotAborted(signal);
      if (modelId !== DEFAULT_LOCAL_TEXT_MODEL.id) {
        throw new Error('This runtime only loads models in the approved local model registry.');
      }
      if (pipe && activeModelId === modelId && (backend === 'auto' || backend === activeBackend)) {
        return this.status;
      }
      const requestKey = modelId + ':' + backend;
      if (loading) {
        if (loadingKey !== requestKey) throw new Error('A different local model load is already in progress.');
        return loading;
      }
      loadingKey = requestKey;
      loading = (async () => {
        const capabilities = await detectDeviceCapabilities(environment);
        assertNotAborted(signal);
        const selectedBackend = backend === 'auto'
          ? (capabilities.secureContext && capabilities.adapterAvailable ? 'webgpu' : 'wasm')
          : backend;
        if (!['webgpu', 'wasm'].includes(selectedBackend)) {
          throw new TypeError('Backend must be auto, webgpu, or wasm.');
        }
        if (selectedBackend === 'webgpu' && (!capabilities.secureContext || !capabilities.adapterAvailable)) {
          throw new Error('WebGPU requires a secure context and a compatible adapter. Choose the WASM backend.');
        }
        if (selectedBackend === 'wasm' && !capabilities.wasmAvailable) {
          throw new Error('WebAssembly is unavailable in this browser.');
        }

        const options = {
          dtype: selectedBackend === 'webgpu'
            ? DEFAULT_LOCAL_TEXT_MODEL.suggestedWebGPUPrecision
            : DEFAULT_LOCAL_TEXT_MODEL.suggestedWasmPrecision,
          progress_callback: info => safeProgress(onProgress, info)
        };
        if (selectedBackend === 'webgpu') options.device = 'webgpu';

        const nextPipe = await pipelineFactory('text-generation', modelId, options);
        assertNotAborted(signal);
        if (typeof nextPipe !== 'function') {
          throw new Error('Transformers.js did not return a text-generation pipeline.');
        }
        pipe = nextPipe;
        activeModelId = modelId;
        activeBackend = selectedBackend;
        return this.status;
      })();

      try {
        return await loading;
      } finally {
        loading = null;
        loadingKey = null;
      }
    },

    async generate(prompt, {
      maxNewTokens = 256,
      temperature = 0.2,
      signal
    } = {}) {
      assertNotAborted(signal);
      if (!pipe) throw new Error('Load the local model before generating text.');
      const input = String(prompt ?? '').trim();
      if (!input) throw new TypeError('A non-empty prompt is required.');
      const tokenLimit = Math.max(16, Math.min(1024, Math.round(Number(maxNewTokens) || 256)));
      const temp = Math.max(0, Math.min(1.5, Number.isFinite(Number(temperature)) ? Number(temperature) : 0.2));
      const output = await pipe(input, {
        max_new_tokens: tokenLimit,
        do_sample: temp > 0,
        temperature: temp,
        repetition_penalty: 1.08,
        return_full_text: false
      });
      // Transformers.js pipeline generation is not interruptible through AbortSignal.
      // Check again so a cancelled request never updates the UI with stale output.
      assertNotAborted(signal);
      const first = Array.isArray(output) ? output[0] : output;
      const generatedText = typeof first?.generated_text === 'string'
        ? first.generated_text.trim()
        : typeof first === 'string' ? first.trim() : '';
      if (!generatedText) throw new Error('The local model returned an empty response.');
      return {
        text: generatedText,
        modelId: activeModelId,
        backend: activeBackend,
        localInference: true,
        remoteInference: false
      };
    }
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalTransformersRuntime, DEFAULT_LOCAL_TEXT_MODEL } from '../src/transformers-local-runtime.js';

const fakeWasm = { instantiate() {} };
const webgpuEnvironment = {
  isSecureContext: true,
  WebAssembly: fakeWasm,
  navigator: { gpu: { requestAdapter: async () => ({ limits: {}, features: new Set() }) } }
};
const wasmEnvironment = { isSecureContext: true, WebAssembly: fakeWasm, navigator: {} };

test('loads the recommended model on WebGPU with a quantized precision', async () => {
  let call;
  const runtime = createLocalTransformersRuntime({
    environment: webgpuEnvironment,
    pipelineFactory: async (...args) => {
      call = args;
      return async () => [{ generated_text: 'A thoughtful story outline.' }];
    }
  });
  const status = await runtime.load({ onProgress: () => {} });
  assert.equal(status.loaded, true);
  assert.equal(status.modelId, DEFAULT_LOCAL_TEXT_MODEL.id);
  assert.equal(status.backend, 'webgpu');
  assert.equal(call[0], 'text-generation');
  assert.equal(call[1], DEFAULT_LOCAL_TEXT_MODEL.id);
  assert.equal(call[2].device, 'webgpu');
  assert.equal(call[2].dtype, 'q4f16');
  const output = await runtime.generate('Write a short story.');
  assert.equal(output.text, 'A thoughtful story outline.');
  assert.equal(output.localInference, true);
  assert.equal(output.remoteInference, false);
});

test('uses WASM when WebGPU is not available', async () => {
  let options;
  const runtime = createLocalTransformersRuntime({
    environment: wasmEnvironment,
    pipelineFactory: async (_task, _model, settings) => {
      options = settings;
      return async () => [{ generated_text: 'Local CPU output.' }];
    }
  });
  const status = await runtime.load();
  assert.equal(status.backend, 'wasm');
  assert.equal(options.device, undefined);
  assert.equal(options.dtype, 'q4');
});

test('requires explicit loading before generation and rejects empty prompts', async () => {
  const runtime = createLocalTransformersRuntime({ environment: wasmEnvironment, pipelineFactory: async () => async () => [] });
  await assert.rejects(runtime.generate('hello'), /Load the local model/);
  await runtime.load();
  await assert.rejects(runtime.generate('   '), /non-empty prompt/);
});

test('rejects unsupported backend and unavailable WebGPU', async () => {
  const runtime = createLocalTransformersRuntime({ environment: wasmEnvironment, pipelineFactory: async () => async () => [] });
  await assert.rejects(runtime.load({ backend: 'cloud' }), /Backend must be/);
  await assert.rejects(runtime.load({ backend: 'webgpu' }), /WebGPU is not available/);
});

test('does not load when the request is already cancelled', async () => {
  let loaded = false;
  const runtime = createLocalTransformersRuntime({
    environment: wasmEnvironment,
    pipelineFactory: async () => { loaded = true; return async () => []; }
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(runtime.load({ signal: controller.signal }), { name: 'AbortError' });
  assert.equal(loaded, false);
});

test('rejects invalid pipeline factory output and empty model responses', async () => {
  const invalid = createLocalTransformersRuntime({ environment: wasmEnvironment, pipelineFactory: async () => ({}) });
  await assert.rejects(invalid.load(), /did not return a text-generation pipeline/);
  const empty = createLocalTransformersRuntime({ environment: wasmEnvironment, pipelineFactory: async () => async () => [] });
  await empty.load();
  await assert.rejects(empty.generate('hello'), /empty response/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { detectDeviceCapabilities } from '../src/device-capabilities.js';

const wasm = { instantiate() {} };

test('detects WebGPU adapter, WASM and advisory hardware/storage estimates', async () => {
  const result = await detectDeviceCapabilities({
    isSecureContext: true,
    WebAssembly: wasm,
    crossOriginIsolated: true,
    SharedArrayBuffer: class SharedArrayBuffer {},
    navigator: {
      hardwareConcurrency: 8,
      deviceMemory: 8,
      gpu: { requestAdapter: async () => ({ limits: { maxBufferSize: 268435456, maxStorageBufferBindingSize: 134217728 }, features: new Set(['shader-f16']) }) },
      storage: { estimate: async () => ({ usage: 100, quota: 1000 }) }
    }
  });
  assert.equal(result.secureContext, true);
  assert.equal(result.webgpuApiAvailable, true);
  assert.equal(result.adapterAvailable, true);
  assert.equal(result.maxStorageBufferBindingSize, 134217728);
  assert.deepEqual(result.gpuFeatures, ['shader-f16']);
  assert.equal(result.wasmAvailable, true);
  assert.equal(result.wasmThreadsAvailable, true);
  assert.equal(result.deviceMemoryGB, 8);
  assert.equal(result.hardwareConcurrency, 8);
  assert.equal(result.storage.availableBytes, 900);
  assert.match(result.recommendation, /does not guarantee enough memory/);
});

test('reports WASM fallback when WebGPU is unavailable', async () => {
  const result = await detectDeviceCapabilities({ isSecureContext: true, WebAssembly: wasm, navigator: {} });
  assert.equal(result.webgpuApiAvailable, false);
  assert.equal(result.adapterAvailable, false);
  assert.equal(result.wasmAvailable, true);
  assert.match(result.recommendation, /WASM inference may still work/);
});

test('reports unavailable WebGPU and WASM without throwing', async () => {
  const result = await detectDeviceCapabilities({ isSecureContext: true, navigator: {} });
  assert.equal(result.webgpuApiAvailable, false);
  assert.equal(result.adapterAvailable, false);
  assert.equal(result.wasmAvailable, false);
  assert.match(result.recommendation, /WebAssembly is unavailable/);
});

test('reports insecure context even when a GPU API exists', async () => {
  const result = await detectDeviceCapabilities({
    isSecureContext: false,
    WebAssembly: wasm,
    navigator: { gpu: { requestAdapter: async () => ({ limits: {} }) } }
  });
  assert.equal(result.adapterAvailable, true);
  assert.match(result.recommendation, /HTTPS/);
});

test('handles missing adapter and unavailable storage estimates', async () => {
  const result = await detectDeviceCapabilities({
    isSecureContext: true,
    WebAssembly: wasm,
    navigator: { gpu: { requestAdapter: async () => null }, storage: { estimate: async () => { throw new Error('blocked'); } } }
  });
  assert.equal(result.adapterAvailable, false);
  assert.equal(result.storage.availableBytes, null);
  assert.match(result.recommendation, /WASM inference may still work/);
});

test('handles a rejected WebGPU adapter request', async () => {
  const result = await detectDeviceCapabilities({
    isSecureContext: true,
    WebAssembly: wasm,
    navigator: { gpu: { requestAdapter: async () => { throw new Error('GPU blocked'); } } }
  });
  assert.equal(result.adapterAvailable, false);
  assert.match(result.recommendation, /GPU blocked/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { detectDeviceCapabilities } from '../src/device-capabilities.js';

test('detects WebGPU adapter and reports advisory hardware/storage estimates', async () => {
  const result = await detectDeviceCapabilities({
    isSecureContext: true,
    navigator: {
      hardwareConcurrency: 8,
      deviceMemory: 8,
      gpu: { requestAdapter: async () => ({ limits: { maxBufferSize: 268435456 } }) },
      storage: { estimate: async () => ({ usage: 100, quota: 1000 }) }
    }
  });
  assert.equal(result.secureContext, true);
  assert.equal(result.webgpuApiAvailable, true);
  assert.equal(result.adapterAvailable, true);
  assert.equal(result.deviceMemoryGB, 8);
  assert.equal(result.hardwareConcurrency, 8);
  assert.equal(result.storage.availableBytes, 900);
  assert.match(result.recommendation, /does not guarantee enough memory/);
});

test('reports unavailable WebGPU without throwing', async () => {
  const result = await detectDeviceCapabilities({ isSecureContext: true, navigator: {} });
  assert.equal(result.webgpuApiAvailable, false);
  assert.equal(result.adapterAvailable, false);
  assert.match(result.recommendation, /WebGPU is unavailable/);
});

test('reports insecure context even when a GPU API exists', async () => {
  const result = await detectDeviceCapabilities({
    isSecureContext: false,
    navigator: { gpu: { requestAdapter: async () => ({ limits: {} }) } }
  });
  assert.equal(result.adapterAvailable, true);
  assert.match(result.recommendation, /HTTPS/);
});

test('handles missing adapter and unavailable storage estimates', async () => {
  const result = await detectDeviceCapabilities({
    isSecureContext: true,
    navigator: { gpu: { requestAdapter: async () => null }, storage: { estimate: async () => { throw new Error('blocked'); } } }
  });
  assert.equal(result.adapterAvailable, false);
  assert.equal(result.storage.availableBytes, null);
  assert.match(result.recommendation, /No compatible WebGPU adapter/);
});

test('handles a rejected WebGPU adapter request', async () => {
  const result = await detectDeviceCapabilities({
    isSecureContext: true,
    navigator: { gpu: { requestAdapter: async () => { throw new Error('GPU blocked'); } } }
  });
  assert.equal(result.adapterAvailable, false);
  assert.match(result.recommendation, /GPU blocked/);
});

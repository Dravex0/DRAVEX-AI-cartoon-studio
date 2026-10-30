const finitePositive = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;

/**
 * Checks browser/device prerequisites without loading a model or starting inference.
 * Results are advisory only: browser APIs do not reveal reliable free GPU memory.
 */
export async function detectDeviceCapabilities(environment = globalThis) {
  const nav = environment?.navigator || {};
  const secureContext = environment?.isSecureContext === true;
  const hardwareConcurrency = finitePositive(nav.hardwareConcurrency);
  const deviceMemoryGB = finitePositive(nav.deviceMemory);
  const wasmAvailable = typeof environment?.WebAssembly?.instantiate === 'function';
  const crossOriginIsolated = environment?.crossOriginIsolated === true;
  const sharedArrayBufferAvailable = typeof environment?.SharedArrayBuffer === 'function';
  const wasmThreadsAvailable = wasmAvailable && crossOriginIsolated && sharedArrayBufferAvailable;
  let adapterAvailable = false;
  let maxBufferSize = null;
  let maxStorageBufferBindingSize = null;
  let gpuFeatures = [];
  let gpuError = '';

  if (nav.gpu && typeof nav.gpu.requestAdapter === 'function') {
    try {
      const adapter = await nav.gpu.requestAdapter();
      adapterAvailable = Boolean(adapter);
      maxBufferSize = finitePositive(adapter?.limits?.maxBufferSize);
      maxStorageBufferBindingSize = finitePositive(adapter?.limits?.maxStorageBufferBindingSize);
      try { gpuFeatures = Array.from(adapter?.features || []).map(String).slice(0, 40); } catch { gpuFeatures = []; }
    } catch (error) {
      gpuError = String(error?.message || 'WebGPU adapter request failed').slice(0, 180);
    }
  }

  let storage = { usageBytes: null, quotaBytes: null, availableBytes: null };
  try {
    const estimate = await nav.storage?.estimate?.();
    const usageBytes = finitePositive(estimate?.usage);
    const quotaBytes = finitePositive(estimate?.quota);
    storage = {
      usageBytes,
      quotaBytes,
      availableBytes: usageBytes !== null && quotaBytes !== null ? Math.max(0, quotaBytes - usageBytes) : null
    };
  } catch {
    // Storage estimates are optional and may be blocked by the browser.
  }

  let recommendation = 'WebGPU adapter detected. Test the selected model separately; this does not guarantee enough memory.';
  if (!secureContext) recommendation = 'A secure HTTPS context is required for browser GPU features.';
  else if (!adapterAvailable && wasmAvailable) recommendation = 'WebGPU is unavailable; local WASM inference may still work, but can be slower.';
  else if (!adapterAvailable) recommendation = gpuError || 'No compatible WebGPU adapter was found and WebAssembly is unavailable.';
  else if (!wasmAvailable) recommendation = 'WebGPU is available, but WebAssembly fallback is unavailable.';
  else if (!wasmThreadsAvailable) recommendation += ' Multi-threaded WASM may be unavailable in this browser context.';

  return {
    secureContext,
    webgpuApiAvailable: Boolean(nav.gpu && typeof nav.gpu.requestAdapter === 'function'),
    adapterAvailable,
    maxBufferSize,
    maxStorageBufferBindingSize,
    gpuFeatures,
    wasmAvailable,
    wasmThreadsAvailable,
    crossOriginIsolated,
    deviceMemoryGB,
    hardwareConcurrency,
    storage,
    recommendation
  };
}

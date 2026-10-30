const finitePositive = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;

/**
 * Checks browser/device prerequisites without loading a model or starting inference.
 * The result is advisory only: a detected adapter does not guarantee that a model fits.
 */
export async function detectDeviceCapabilities(environment = globalThis) {
  const nav = environment?.navigator || {};
  const secureContext = environment?.isSecureContext === true;
  const hardwareConcurrency = finitePositive(nav.hardwareConcurrency);
  const deviceMemoryGB = finitePositive(nav.deviceMemory);
  let adapterAvailable = false;
  let maxBufferSize = null;
  let gpuError = '';

  if (nav.gpu && typeof nav.gpu.requestAdapter === 'function') {
    try {
      const adapter = await nav.gpu.requestAdapter();
      adapterAvailable = Boolean(adapter);
      maxBufferSize = finitePositive(adapter?.limits?.maxBufferSize);
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
  else if (!nav.gpu || typeof nav.gpu.requestAdapter !== 'function') recommendation = 'WebGPU is unavailable in this browser. Keep cloud or manual image workflows available.';
  else if (!adapterAvailable) recommendation = gpuError || 'No compatible WebGPU adapter was found on this device.';

  return {
    secureContext,
    webgpuApiAvailable: Boolean(nav.gpu && typeof nav.gpu.requestAdapter === 'function'),
    adapterAvailable,
    maxBufferSize,
    deviceMemoryGB,
    hardwareConcurrency,
    storage,
    recommendation
  };
}

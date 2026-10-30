const API_BASE = 'https://aihorde.net/api/v2';
const ANONYMOUS_KEY = '0000000000';
const CLIENT_AGENT = 'DRAVEX-AI-Cartoon-Studio:0.2.0:https://github.com/Dravex0/DRAVEX-AI-cartoon-studio';

function clean(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

async function readJson(response, label) {
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error(`AI Horde ${label} returned an unreadable response (HTTP ${response.status}).`); }
  if (!response.ok) {
    const detail = clean(payload?.message || payload?.error, 240);
    throw new Error(detail || `AI Horde ${label} failed (HTTP ${response.status}).`);
  }
  return payload;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw new DOMException('Image generation was cancelled.', 'AbortError');
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Image generation was cancelled.', 'AbortError'));
    const timer = setTimeout(done, ms);
    function done() {
      signal?.removeEventListener('abort', abort);
      resolve();
    }
    function abort() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(new DOMException('Image generation was cancelled.', 'AbortError'));
    }
    signal?.addEventListener('abort', abort, { once: true });
  });
}

/**
 * Generates one still image using the anonymous, community-powered AI Horde queue.
 * Call only after the user explicitly consents to send the text prompt to volunteer workers.
 * Anonymous AI Horde requests are shared with LAION by service policy.
 */
export async function generateImageWithHorde({
  prompt,
  negativePrompt = '',
  width = 512,
  height = 512,
  steps = 20,
  fetchImpl = fetch,
  signal,
  onProgress = () => {},
  pollIntervalMs = 2500,
  maxWaitMs = 300000
} = {}) {
  const positive = clean(prompt, 10000);
  const negative = clean(negativePrompt, 2000);
  if (!positive) throw new Error('Add an image prompt before generating.');
  const safeWidth = Math.max(256, Math.min(768, Math.round(Number(width) / 64) * 64 || 512));
  const safeHeight = Math.max(256, Math.min(768, Math.round(Number(height) / 64) * 64 || 512));
  const safeSteps = Math.max(10, Math.min(30, Math.round(Number(steps) || 20)));
  const headers = {
    'Content-Type': 'application/json',
    'Client-Agent': CLIENT_AGENT,
    apikey: ANONYMOUS_KEY
  };
  const body = {
    prompt: negative ? `${positive}###${negative}` : positive,
    params: { width: safeWidth, height: safeHeight, steps: safeSteps, n: 1, cfg_scale: 7.5 },
    nsfw: false,
    censor_nsfw: true,
    trusted_workers: true,
    validated_backends: true,
    slow_workers: true,
    r2: true,
    // Anonymous AI Horde requests are shared by service policy; be explicit about that.
    shared: true,
    replacement_filter: true
  };

  throwIfAborted(signal);
  const submitResponse = await fetchImpl(`${API_BASE}/generate/async`, {
    method: 'POST', headers, body: JSON.stringify(body), signal
  });
  const submitted = await readJson(submitResponse, 'submission');
  const requestId = clean(submitted?.id, 80);
  if (!requestId) throw new Error('AI Horde accepted no request ID. Please try again later.');

  const deadline = Date.now() + Math.max(1000, Math.min(600000, Number(maxWaitMs) || 300000));
  let lastCheck = {};
  try {
    while (Date.now() < deadline) {
      throwIfAborted(signal);
      await wait(Math.max(0, Math.min(10000, Number(pollIntervalMs) || 0)), signal);
      const checkResponse = await fetchImpl(`${API_BASE}/generate/check/${encodeURIComponent(requestId)}`, {
        method: 'GET', headers, signal
      });
      lastCheck = await readJson(checkResponse, 'status check');
      if (lastCheck.faulted) throw new Error('AI Horde reported a generation fault. Try again.');
      if (lastCheck.is_possible === false) throw new Error('No compatible volunteer worker is currently available for this image.');
      onProgress({
        queuePosition: Number.isFinite(lastCheck.queue_position) ? lastCheck.queue_position : null,
        waiting: Number.isFinite(lastCheck.waiting) ? lastCheck.waiting : 0,
        processing: Number.isFinite(lastCheck.processing) ? lastCheck.processing : 0,
        waitTimeSeconds: Number.isFinite(lastCheck.wait_time) ? lastCheck.wait_time : null
      });
      if (lastCheck.done) break;
    }
    if (!lastCheck.done) {
      try {
        await fetchImpl(`${API_BASE}/generate/status/${encodeURIComponent(requestId)}`, { method: 'DELETE', headers });
      } catch {}
      throw new Error('The free volunteer queue took too long. The request was cancelled; try again later.');
    }

    const resultResponse = await fetchImpl(`${API_BASE}/generate/status/${encodeURIComponent(requestId)}`, {
      method: 'GET', headers, signal
    });
    const result = await readJson(resultResponse, 'result retrieval');
    const generation = Array.isArray(result?.generations) ? result.generations.find(item => item && !item.censored && item.img) : null;
    if (!generation) throw new Error('AI Horde finished, but returned no usable image. Try another prompt.');
    const image = clean(generation.img, 5000);
    const imageUrl = /^https:\/\//i.test(image)
      ? image
      : /^data:image\//i.test(image)
        ? image
        : /^[A-Za-z0-9+/=]+$/.test(image)
          ? `data:image/webp;base64,${image}`
          : '';
    if (!imageUrl) throw new Error('AI Horde returned an unsupported image result.');
    return {
      requestId,
      imageUrl,
      seed: clean(generation.seed, 80),
      model: clean(generation.model, 120),
      workerName: clean(generation.worker_name, 120),
      shared: result.shared !== false
    };
  } catch (error) {
    if (signal?.aborted) {
      try {
        await fetchImpl(`${API_BASE}/generate/status/${encodeURIComponent(requestId)}`, { method: 'DELETE', headers });
      } catch {}
      throw new DOMException('Image generation was cancelled.', 'AbortError');
    }
    throw error;
  }
}

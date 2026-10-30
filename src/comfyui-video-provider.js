const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'mkv']);
const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;

function abortError() {
  const error = new Error('ComfyUI video generation was cancelled.');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function normalizeBaseUrl(value) {
  let url;
  try { url = new URL(String(value ?? '').trim()); }
  catch { throw new TypeError('Enter a valid ComfyUI server URL, for example http://127.0.0.1:8188.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new TypeError('ComfyUI URL must use HTTP(S) and cannot contain credentials, query parameters or a fragment.');
  }
  return url.href.replace(/\/$/, '');
}

async function readJson(response, label) {
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error(`ComfyUI ${label} returned an unreadable response (HTTP ${response.status}).`); }
  if (!response.ok) {
    const detail = String(payload?.error?.message || payload?.message || payload?.error || '').trim().slice(0, 300);
    throw new Error(detail || `ComfyUI ${label} failed (HTTP ${response.status}).`);
  }
  return payload;
}

function resolveImageSource(image) {
  const blob = typeof Blob !== 'undefined' && image instanceof Blob ? image : image?.blob;
  const filename = String(image?.filename || (typeof File !== 'undefined' && image instanceof File ? image.name : '') || 'dravex-source.png').slice(0, 180);
  if (!(typeof Blob !== 'undefined' && blob instanceof Blob)) {
    throw new TypeError('ComfyUI image-to-video requires a local Blob or File as its source image.');
  }
  if (!/^image\/(png|jpeg|webp)$/i.test(blob.type)) {
    throw new TypeError('Source image must be PNG, JPEG or WebP.');
  }
  if (!blob.size || blob.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new RangeError('Source image must be between 1 byte and 20 MB.');
  }
  return { blob, filename };
}

function findVideoOutput(historyEntry) {
  const outputs = historyEntry?.outputs;
  if (!outputs || typeof outputs !== 'object') return null;
  for (const nodeOutput of Object.values(outputs)) {
    for (const field of ['videos', 'gifs']) {
      const files = Array.isArray(nodeOutput?.[field]) ? nodeOutput[field] : [];
      for (const file of files) {
        const filename = String(file?.filename || '');
        const extension = filename.split('.').pop()?.toLowerCase();
        if (!VIDEO_EXTENSIONS.has(extension)) continue;
        const type = String(file?.type || 'output');
        if (!['output', 'temp'].includes(type)) continue;
        return {
          filename,
          subfolder: String(file?.subfolder || ''),
          type
        };
      }
    }
  }
  return null;
}

function waitForNextPoll(ms, signal) {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal);
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(abortError());
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Creates a local ComfyUI image-to-video adapter.
 * A workflow builder is deliberately injected: DRAVEX must use a workflow whose
 * video model and custom nodes are actually installed on the user's ComfyUI server.
 */
export function createComfyUiVideoProvider({
  baseUrl,
  buildWorkflow,
  fetchImpl = fetch,
  pollIntervalMs = 1500,
  maxWaitMs = 15 * 60 * 1000,
  FormDataClass = globalThis.FormData
} = {}) {
  const endpoint = normalizeBaseUrl(baseUrl);
  if (typeof buildWorkflow !== 'function') {
    throw new TypeError('A ComfyUI workflow builder is required; no model-specific workflow is assumed.');
  }
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.');
  if (typeof FormDataClass !== 'function') throw new TypeError('FormData is not supported in this runtime.');

  return Object.freeze({
    id: 'comfyui-local',
    name: 'ComfyUI (local)',
    taskTypes: Object.freeze(['image-to-video']),
    local: true,
    requiresUserKey: false,
    async generate(request, context = {}) {
      const signal = context.signal;
      throwIfAborted(signal);
      const source = resolveImageSource(request.image);
      const form = new FormDataClass();
      form.append('image', source.blob, source.filename);
      const uploadResponse = await fetchImpl(`${endpoint}/upload/image`, {
        method: 'POST',
        body: form,
        signal
      });
      const uploaded = await readJson(uploadResponse, 'image upload');
      if (!uploaded?.name) throw new Error('ComfyUI image upload returned no filename.');
      const sourceImage = {
        name: String(uploaded.name),
        subfolder: String(uploaded.subfolder || ''),
        type: String(uploaded.type || 'input')
      };
      const workflow = await buildWorkflow({ request, sourceImage });
      if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow) || !Object.keys(workflow).length) {
        throw new TypeError('ComfyUI workflow builder must return a non-empty API workflow object.');
      }

      throwIfAborted(signal);
      const promptResponse = await fetchImpl(`${endpoint}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow }),
        signal
      });
      const submitted = await readJson(promptResponse, 'prompt submission');
      const promptId = String(submitted?.prompt_id || '').trim();
      if (!promptId) {
        const detail = submitted?.error?.message || submitted?.node_errors
          ? 'ComfyUI rejected the workflow. Check that its nodes and model are installed.'
          : 'ComfyUI accepted no prompt ID.';
        throw new Error(detail);
      }

      const interval = boundedNumber(pollIntervalMs, 1500, 250, 10000);
      const timeout = boundedNumber(maxWaitMs, 15 * 60 * 1000, 10000, 60 * 60 * 1000);
      const deadline = Date.now() + timeout;
      let lastProgress = '';
      while (Date.now() < deadline) {
        throwIfAborted(signal);
        const historyResponse = await fetchImpl(`${endpoint}/history/${encodeURIComponent(promptId)}`, {
          method: 'GET',
          signal
        });
        const history = await readJson(historyResponse, 'job status');
        const entry = history?.[promptId] || history?.history?.[promptId] || null;
        if (entry) {
          const status = entry.status || {};
          const statusText = String(status.status_str || '').toLowerCase();
          if (statusText === 'error' || statusText === 'failed') {
            throw new Error('ComfyUI could not complete this video workflow. Check the server console for the failing node.');
          }
          const video = findVideoOutput(entry);
          if (video) {
            const viewUrl = new URL(`${endpoint}/view`);
            viewUrl.searchParams.set('filename', video.filename);
            if (video.subfolder) viewUrl.searchParams.set('subfolder', video.subfolder);
            viewUrl.searchParams.set('type', video.type);
            return {
              status: 'completed',
              taskId: promptId,
              url: viewUrl.href
            };
          }
          if (status.completed === true) {
            throw new Error('ComfyUI finished the workflow but returned no MP4, WebM, MOV or MKV video output.');
          }
          const progress = status.status_str || (status.completed ? 'completed' : 'processing');
          if (progress !== lastProgress) {
            lastProgress = progress;
            context.onProgress?.({ status: 'processing', taskId: promptId, detail: String(progress) });
          }
        } else {
          context.onProgress?.({ status: 'queued', taskId: promptId });
        }
        await waitForNextPoll(interval, signal);
      }
      throw new Error(`ComfyUI job ${promptId} exceeded the configured wait limit. The server job may still be running.`);
    }
  });
}

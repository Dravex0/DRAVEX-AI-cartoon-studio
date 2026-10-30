const VIDEO_EXTENSIONS = new Map([
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.mov', 'video/quicktime'],
  ['.m4v', 'video/mp4']
]);

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

export class ComfyUIAdapterError extends Error {
  constructor(message, code = 'COMFYUI_ERROR', details = null) {
    super(message);
    this.name = 'ComfyUIAdapterError';
    this.code = code;
    this.details = details;
  }
}

function localHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1') return true;
  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  return octets[0] === 127 || octets[0] === 10 ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31);
}

export function normalizeComfyUIBaseUrl(value) {
  let url;
  try { url = new URL(clean(value, 1000)); }
  catch { throw new ComfyUIAdapterError('Enter a valid local ComfyUI address, for example http://127.0.0.1:8188.', 'INVALID_BASE_URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || !localHost(url.hostname)) {
    throw new ComfyUIAdapterError('ComfyUI must use a local or private-network HTTP(S) address without credentials, query parameters or fragments.', 'NON_LOCAL_BASE_URL');
  }
  return url.toString().replace(/\/$/, '');
}

async function readJson(response, label) {
  let payload;
  try { payload = await response.json(); }
  catch { throw new ComfyUIAdapterError(`ComfyUI ${label} returned an unreadable response (HTTP ${response.status}).`, 'INVALID_RESPONSE'); }
  if (!response.ok) {
    const message = clean(payload?.error?.message || payload?.message || payload?.error, 500);
    throw new ComfyUIAdapterError(message || `ComfyUI ${label} failed (HTTP ${response.status}).`, 'HTTP_ERROR', payload?.node_errors || null);
  }
  return payload;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const error = new Error('ComfyUI generation was cancelled.');
    error.name = 'AbortError';
    throw error;
  }
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal);
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    function abort() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      const error = new Error('ComfyUI generation was cancelled.');
      error.name = 'AbortError';
      reject(error);
    }
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function cloneWorkflow(workflow) {
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    throw new ComfyUIAdapterError('Provide a ComfyUI API-format workflow object.', 'INVALID_WORKFLOW');
  }
  try { return structuredClone(workflow); }
  catch { return JSON.parse(JSON.stringify(workflow)); }
}

function applyBinding(workflow, binding, value, key) {
  if (!binding) return;
  const nodeId = clean(binding.nodeId, 100);
  const inputName = clean(binding.input, 120);
  const node = workflow[nodeId];
  if (!node || !node.inputs || !Object.prototype.hasOwnProperty.call(node.inputs, inputName)) {
    throw new ComfyUIAdapterError(`Workflow binding "${key}" points to a missing node input (${nodeId}.${inputName}).`, 'INVALID_WORKFLOW_BINDING');
  }
  node.inputs[inputName] = value;
}

function outputVideo(history, outputNodeIds) {
  for (const nodeId of outputNodeIds) {
    const output = history?.outputs?.[nodeId];
    for (const key of ['videos', 'gifs']) {
      const entries = Array.isArray(output?.[key]) ? output[key] : [];
      const item = entries.find(entry => {
        const filename = clean(entry?.filename, 500).toLowerCase();
        return [...VIDEO_EXTENSIONS.keys()].some(extension => filename.endsWith(extension));
      });
      if (item) return item;
    }
  }
  return null;
}

function viewUrl(baseUrl, item) {
  const url = new URL('/view', baseUrl);
  url.searchParams.set('filename', item.filename);
  url.searchParams.set('subfolder', clean(item.subfolder, 500));
  url.searchParams.set('type', clean(item.type, 40) || 'output');
  return url.toString();
}

/** Check the local ComfyUI HTTP API. This never submits a prompt or uploads media. */
export async function checkComfyUIConnection({ baseUrl, fetchImpl = fetch, signal } = {}) {
  const base = normalizeComfyUIBaseUrl(baseUrl);
  let response;
  try {
    response = await fetchImpl(`${base}/system_stats`, { method: 'GET', signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ComfyUIAdapterError('Cannot reach ComfyUI. Check that the local server is running and its browser CORS policy allows this site.', 'CONNECTION_FAILED');
  }
  const system = await readJson(response, 'connection check');
  return { ok: true, system };
}

/**
 * Local ComfyUI image-to-video adapter.
 * The caller supplies an API-format workflow and explicit node/input bindings;
 * no model, workflow nodes, hosted endpoint or outbound service is assumed.
 */
export function createComfyUIVideoProvider({
  baseUrl,
  workflow,
  nodeBindings = {},
  outputNodeIds = [],
  fetchImpl = fetch,
  pollIntervalMs = 1500,
  maxWaitMs = 600000,
  frameCountStep = 1,
  frameCountOffset = 0,
  clientId = 'dravex-cartoon-studio'
} = {}) {
  const base = normalizeComfyUIBaseUrl(baseUrl);
  const template = cloneWorkflow(workflow);
  const outputs = [...new Set((Array.isArray(outputNodeIds) ? outputNodeIds : []).map(id => clean(id, 100)).filter(Boolean))];
  if (!outputs.length) throw new ComfyUIAdapterError('Select at least one workflow node that produces an MP4, WebM or MOV output.', 'MISSING_OUTPUT_NODE');
  if (!nodeBindings?.prompt || !nodeBindings?.image) {
    throw new ComfyUIAdapterError('Workflow bindings must include prompt and image node inputs.', 'MISSING_REQUIRED_BINDING');
  }
  // Validate every configured mapping at construction time, before any network call.
  for (const [key, binding] of Object.entries(nodeBindings)) applyBinding(cloneWorkflow(template), binding, '__validation__', key);
  const interval = Math.max(250, Math.min(10000, Number(pollIntervalMs) || 1500));
  const timeout = Math.max(1000, Math.min(1800000, Number(maxWaitMs) || 600000));
  const frameStep = Math.max(1, Math.min(120, Math.round(Number(frameCountStep) || 1)));
  const frameOffset = Math.max(0, Math.min(frameStep - 1, Math.round(Number(frameCountOffset) || 0)));

  return Object.freeze({
    id: 'comfyui-local',
    name: 'Local ComfyUI',
    taskTypes: Object.freeze(['image-to-video']),
    local: true,
    requiresUserKey: false,
    async generate(request, context = {}) {
      throwIfAborted(context.signal);
      if (!request.image || typeof request.image.arrayBuffer !== 'function') {
        throw new ComfyUIAdapterError('The source image must be a browser File or Blob.', 'INVALID_SOURCE_IMAGE');
      }
      const form = new FormData();
      const filename = clean(request.image.name, 180).replace(/[^a-z0-9._-]/gi, '_') || 'dravex-scene.png';
      form.append('image', request.image, filename);
      form.append('overwrite', 'true');
      let uploadResponse;
      try {
        uploadResponse = await fetchImpl(`${base}/upload/image`, { method: 'POST', body: form, signal: context.signal });
      } catch (error) {
        if (context.signal?.aborted) throw error;
        throw new ComfyUIAdapterError('ComfyUI could not receive the source image. Check server availability and CORS.', 'UPLOAD_FAILED');
      }
      const uploaded = await readJson(uploadResponse, 'image upload');
      const uploadedName = clean(uploaded?.name, 500);
      if (!uploadedName) throw new ComfyUIAdapterError('ComfyUI upload response did not contain an image name.', 'INVALID_UPLOAD_RESPONSE');
      const imagePath = [clean(uploaded.subfolder, 500), uploadedName].filter(Boolean).join('/');

      const graph = cloneWorkflow(template);
      const values = {
        prompt: request.prompt,
        negativePrompt: request.negativePrompt || '',
        image: imagePath,
        durationSeconds: request.durationSeconds,
        fps: request.fps,
        frameCount: frameOffset + Math.max(1, Math.ceil((request.durationSeconds * request.fps - frameOffset) / frameStep)) * frameStep,
        seed: request.seed ?? 0
      };
      for (const [key, binding] of Object.entries(nodeBindings)) {
        if (Object.prototype.hasOwnProperty.call(values, key)) applyBinding(graph, binding, values[key], key);
      }

      throwIfAborted(context.signal);
      const submitResponse = await fetchImpl(`${base}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: graph, client_id: clean(clientId, 120) || 'dravex-cartoon-studio' }),
        signal: context.signal
      });
      const submitted = await readJson(submitResponse, 'prompt submission');
      const promptId = clean(submitted?.prompt_id, 120);
      if (!promptId) {
        throw new ComfyUIAdapterError('ComfyUI did not return a prompt_id. Check workflow node errors.', 'MISSING_PROMPT_ID', submitted?.node_errors || null);
      }
      const startedAt = Date.now();
      const deadline = startedAt + timeout;
      context.onProgress?.({ stage: 'queued', promptId, elapsedMs: 0 });

      while (Date.now() < deadline) {
        await wait(interval, context.signal);
        const historyResponse = await fetchImpl(`${base}/history/${encodeURIComponent(promptId)}`, {
          method: 'GET', signal: context.signal
        });
        const historyPayload = await readJson(historyResponse, 'history lookup');
        const history = historyPayload?.[promptId];
        context.onProgress?.({ stage: history ? 'processing' : 'queued', promptId, elapsedMs: Date.now() - startedAt });
        if (!history) continue;
        if (history.status?.status_str === 'error' || history.status?.completed === false && history.status?.messages?.some(message => message?.[0] === 'execution_error')) {
          throw new ComfyUIAdapterError('ComfyUI workflow execution failed. Inspect the local ComfyUI console for the node error.', 'WORKFLOW_FAILED', history.status?.messages || null);
        }
        const item = outputVideo(history, outputs);
        if (!item) {
          if (history.status?.completed === true) {
            throw new ComfyUIAdapterError('Workflow finished but the selected output nodes did not produce MP4, WebM or MOV video.', 'VIDEO_OUTPUT_NOT_FOUND');
          }
          continue;
        }
        const videoResponse = await fetchImpl(viewUrl(base, item), { method: 'GET', signal: context.signal });
        if (!videoResponse.ok) throw new ComfyUIAdapterError(`ComfyUI video download failed (HTTP ${videoResponse.status}).`, 'VIDEO_DOWNLOAD_FAILED');
        const video = await videoResponse.blob();
        if (!video.size) throw new ComfyUIAdapterError('ComfyUI returned an empty video file.', 'EMPTY_VIDEO');
        const extension = Object.keys(Object.fromEntries(VIDEO_EXTENSIONS)).find(ext => clean(item.filename).toLowerCase().endsWith(ext));
        const mimeType = VIDEO_EXTENSIONS.get(extension) || video.type || 'application/octet-stream';
        const resultBlob = video.type ? video : new Blob([video], { type: mimeType });
        context.onProgress?.({ stage: 'completed', promptId, elapsedMs: Date.now() - startedAt });
        return { status: 'completed', taskId: promptId, video: resultBlob };
      }
      throw new ComfyUIAdapterError('ComfyUI generation timed out. The local workflow may still be running; inspect its queue before retrying.', 'TIMEOUT');
    }
  });
}

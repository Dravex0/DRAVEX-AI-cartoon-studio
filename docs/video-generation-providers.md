# Video generation provider contract

DRAVEX uses a provider-neutral contract for optional video-generation engines.

- The editor and storyboard remain usable when no video provider is configured.
- Providers register explicitly and declare supported task types.
- Requests are validated before a provider is called (prompt, source media, duration and FPS).
- Providers may return queued/processing/pending jobs or a completed Blob/URL.
- Cancellation is forwarded as an AbortSignal-like context.
- Provider keys and network calls are owned by the provider adapter, never hard-coded into the editor.
- This contract does not bundle a model, create a hosted endpoint, or make generation free by itself.

## Local ComfyUI adapter

`src/comfyui-video-provider.js` adds an opt-in image-to-video adapter for a ComfyUI server controlled by the user.

1. Start ComfyUI on the user's computer and enable its HTTP API.
2. Export a workflow in **API format** (not the ordinary UI workflow JSON).
3. Configure its prompt and image node input bindings, optional negative-prompt/duration/FPS/frame-count/seed bindings, and the node IDs that produce video output.
4. Call `checkComfyUIConnection({ baseUrl })` before registering the provider. The check only reads `/system_stats`; it does not upload a file or submit a prompt.
5. Register the returned provider with `createVideoProviderRegistry()` and call it through `generateVideoWithProvider()`.

The adapter uploads the selected source image to the local ComfyUI `/upload/image` endpoint, submits the configured graph to `/prompt`, polls `/history/{prompt_id}`, and downloads an MP4/WebM/MOV result from `/view`. It does not choose a model or create a workflow automatically. The workflow's nodes, model files, custom nodes and output node must already be installed and working in ComfyUI.

The base URL is restricted to loopback or private-network addresses. A normal GitHub Pages site may still be unable to contact the local server unless the browser accepts the local-network request and ComfyUI is configured to allow the site's origin (CORS). HTTPS pages, browser mixed-content rules, firewall settings and local-network permission prompts can affect this connection. Do not expose ComfyUI's unauthenticated API to the public internet.

This adapter is a tested integration module, not yet wired into the Cartoon Studio UI. No model is bundled, no hosted video service is called, and no video is generated until the user explicitly configures a local workflow and starts a generation request. Hardware requirements depend on the selected ComfyUI model and workflow; Android browser alone is not expected to run large diffusion models.

## Privacy and cost

Local inference is intended to keep scene prompts and source images on the user's configured local/private ComfyUI server. Network traffic to that server is still sent over the user's LAN or loopback connection. No remote fallback is performed. Model licences, VRAM/RAM requirements and custom-node dependencies must be checked for the exact workflow before use.

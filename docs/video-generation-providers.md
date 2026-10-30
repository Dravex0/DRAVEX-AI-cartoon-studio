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

The adapter uploads the selected source image to the local ComfyUI `/upload/image` endpoint, submits the configured graph to `/prompt`, polls `/history/{prompt_id}`, and downloads an MP4/WebM/MOV result from `/view`. The downloaded Blob is used as a same-origin object URL, allowing the canvas preview/export to draw video frames without relying on remote video-host CORS. It does not choose a model or create a workflow automatically. The workflow's nodes, model files, custom nodes and output node must already be installed and working in ComfyUI.

The base URL is restricted to loopback or private-network addresses. A normal GitHub Pages site may still be unable to contact the local server unless the browser accepts the local-network request and ComfyUI is configured to allow the site's origin (CORS). HTTPS pages, browser mixed-content rules, firewall settings and local-network permission prompts can affect this connection. Do not expose ComfyUI's unauthenticated API to the public internet.

The adapter is now exposed in the scene editor's **Local video animation · ComfyUI** panel. The user selects an API-format workflow JSON, configures node bindings, checks the local connection, then chooses **Animate this scene**. The selected scene must have a generated still image, or the user can provide a local PNG/JPEG/WebP image in the ComfyUI panel. The local image takes priority and is uploaded only to the configured local/private ComfyUI server after the user starts generation. The workflow JSON is kept in browser memory and must be selected again after a page reload. Generated scene videos are cached in memory by scene identity, shown in the scene video player, and drawn into the canvas preview. The existing canvas-based multi-scene WebM export therefore records the generated clip for each scene that has one; scenes without generated clips continue to use their still image or existing canvas preview. Generated video blobs/object URLs are runtime-only and are not included in saved drafts, so regenerate them after a reload. No model is bundled and no hosted video service is called. Hardware requirements depend on the selected ComfyUI model and workflow; Android browser alone is not expected to run large diffusion models.


## Recommended starter workflow: Wan2.2 TI2V 5B

The best first local model to evaluate is the official ComfyUI **Wan2.2 TI2V 5B** hybrid template. It supports both text-to-video and image-to-video; ComfyUI's documentation says it should fit on 8 GB VRAM with native offloading. This is a vendor-reported starting point, not a guarantee for every GPU, resolution, frame count or other running applications. The model family is Apache 2.0 licensed. See the [official ComfyUI Wan2.2 guide](https://docs.comfy.org/tutorials/video/wan/wan2_2) and [official workflow template](https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_wan2_2_5B_ti2v.json).

The current official template uses these node IDs in its editable workflow:
- Positive prompt: node `6`, input `text`
- Negative prompt: node `7`, input `text`
- Source image: node `56`, input `image`
- Wan image-to-video latent length: node `55`, input `length`
- Video frame rate: node `57`, input `fps`
- Save video output: node `58`

The source-image node is disabled in the template by default; enable it with **Ctrl+B** before exporting the workflow in API format. Check the exported API JSON still contains these node IDs and inputs before using the example mapping. ComfyUI template node IDs can change in later revisions.

Example adapter configuration (the `workflow` value must be the API-format JSON exported from your own ComfyUI instance):

```js
const provider = createComfyUIVideoProvider({
  baseUrl: 'http://127.0.0.1:8188',
  workflow: exportedApiWorkflow,
  nodeBindings: {
    prompt: { nodeId: '6', input: 'text' },
    negativePrompt: { nodeId: '7', input: 'text' },
    image: { nodeId: '56', input: 'image' },
    frameCount: { nodeId: '55', input: 'length' },
    fps: { nodeId: '57', input: 'fps' }
  },
  outputNodeIds: ['58'],
  frameCountStep: 8,
  frameCountOffset: 1
});
```

Wan's latent length uses the template's 1 + 8N frame cadence. The adapter's optional `frameCountStep` and `frameCountOffset` settings round requested duration upward to a valid frame count; for this workflow use step 8 and offset 1. Actual clip duration can therefore differ slightly from the requested duration. The `CreateVideo` node's FPS binding controls playback rate.

The 14B Wan2.2 I2V workflow is a higher-compute alternative, not the default starter. LTX-2.5's current ComfyUI guide lists 32 GB+ VRAM and 100 GB+ free disk as prerequisites, so it is not the low-hardware option. Always check the exact model licence, weight downloads, VRAM and custom-node requirements before installation.

## Privacy and cost

Local inference is intended to keep scene prompts and source images on the user's configured local/private ComfyUI server. Network traffic to that server is still sent over the user's LAN or loopback connection. No remote fallback is performed. Model licences, VRAM/RAM requirements and custom-node dependencies must be checked for the exact workflow before use.

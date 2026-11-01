# DRAVEX AI Cartoon Studio

A free-first cartoon studio for turning story text into a structured storyboard and assembling short animated scenes. It includes an opt-in local language model for experimental scene direction, optional AI still generation, short image-to-video generation through Hugging Face ZeroGPU or local ComfyUI, and a browser-based multi-scene WebM assembly workflow. Production voice synthesis and phoneme-level lip-sync are still in development.

## Storyboard engine foundation

- `src/scene-model.js` normalizes current and legacy scene shapes into a predictable scene structure.
- `src/story-qa.js` performs deterministic text-level checks for missing actions, duplicate IDs, repetitive prompts, duration normalization, and dialogue/character mismatches. It does not inspect rendered video or claim model-level understanding.
- `src/scene-production.js` assembles separate still-image and motion prompts using camera direction, start/end states, negative constraints, and matching Character Bible entries.
- `src/device-capabilities.js` checks HTTPS, WebGPU adapter availability, WASM fallback, approximate browser memory, CPU threads, and browser storage before a local model load. This is advisory only; it does not guarantee model compatibility.
- `src/transformers-local-runtime.js` loads the approved `onnx-community/SmolLM2-135M-Instruct-ONNX` model through Transformers.js after explicit user consent. Model weights are downloaded from Hugging Face on first load; generation runs locally in the browser using WebGPU when available or WASM otherwise. The q4f16 weight file is approximately 117 MB; browser cache persistence depends on storage policy.
- `src/local-story-director.js` uses that local model to propose scene actions, camera directions, image/motion prompts, and continuity states. Source-story details, event order, and character membership are locked to the deterministic baseline. Candidate scenes must pass a text-level quality gate or DRAVEX keeps the deterministic fallback.
- `src/ai-horde-image-provider.js` optionally generates one still image through the free, volunteer-powered AI Horde queue. It sends text prompts only, never source photos or videos, and is gated by an explicit in-app consent checkbox.
- `src/image-frame.js` crops generated stills to the canvas aspect ratio without stretching. The browser loads images with anonymous CORS mode; if the image host does not permit canvas access, the procedural preview remains usable.
- `src/prompt-camera-motion.js` maps scene motion instructions such as push-in, pull-back, pan-left/right and tilt-up/down to bounded 2D camera moves on generated still images.
- `src/huggingface-zerogpu-video-provider.js` optionally animates a scene still through the public Wan 2.2 14B Fast Hugging Face ZeroGPU Space. It requires a user-provided read token and separate explicit consent before scene images/prompts are uploaded.
- `src/comfyui-video-provider.js` provides an alternative local/private ComfyUI image-to-video path when the user has a configured local server and API workflow.
- `src/scene-video-batch.js` processes storyboard scenes sequentially, reports actual completed/failed/skipped clips, supports cancellation/resume, and hands a complete set of clips to the final WebM export.
- `src/export-timeline.js` builds a bounded, per-scene timeline so the WebM test export visits all storyboard scenes using their own durations.
- `fixtures/aster-awakening.js` contains an eight-scene, 23-second continuity fixture.
- `tests/story-qa.test.js` exercises normalization and storyboard QA behavior.
- `.github/workflows/quality.yml` runs syntax checks, tests, and a production build on pushes and pull requests.

## Requirements

- Node.js 22+
- npm

## Local development

```sh
npm install
npm run check
npm test
npm run build
npm run dev
```

The Vite build is a separate development bundle. The root `index.html` is the published standalone workspace. Preview and WebM export use a 1280×720 (16:9) canvas with a 640×360 logical drawing space; AI still-image profiles use landscape dimensions to reduce destructive cropping into the widescreen frame. The deterministic director engine varies preview framing from scene text and camera metadata. The storyboard is currently planned by a deterministic local engine; it is not yet a trained generative neural model.

## Current limitations

- Local story planning and cinematic direction use deterministic text heuristics; they do not visually understand generated frames.
- The deterministic planner remains the safe baseline. The optional SmolLM2 model is a small open-weight text model, not a model trained by DRAVEX; it may return weak or malformed output, which is rejected by the quality gate. It does not visually understand images or generate scene artwork/video.
- The scene editor exposes editable image/motion prompts, continuity locks, and a preview of the assembled AI instructions. Motion prompts can guide the still-image camera fallback or an optional image-to-video provider. The public Wan 2.2 ZeroGPU provider produces short 480p-class clips (up to 5 seconds at 16 FPS); it does not guarantee perfect character identity or studio-quality anime.
- Hugging Face currently documents up to 5 GPU minutes/day for free accounts using ZeroGPU Spaces (2 minutes/day without authentication). The quota is shared with other ZeroGPU Spaces and may not complete a whole film in one session. Completed clips are kept in local browser storage so generation can resume after quota reset.
- The optional local AI hardware check does not prove that a particular language or diffusion model will fit or run on the device. Real Android performance and model quality still require device testing.
- AI Horde is a remote community queue, not local inference. Anonymous requests have low priority and may be slow; the service shares anonymous requests with LAION and may collect prompt and IP/usage data. The app requires explicit consent before sending a prompt. See the [AI Horde privacy policy](https://horde.aivo.chat/privacy).
- Generated AI Horde stills are now drawn into the selected scene's canvas preview and are included in the canvas-based WebM capture when the image host permits anonymous CORS access. The preview uses a subtle Ken Burns zoom. If CORS blocks drawing, the side preview remains available and the canvas falls back to its procedural scene; no tainted canvas is exported.
- The canvas preview uses generated scene video clips when available. Without a clip it falls back to generated stills with bounded camera movement, or procedural shapes when no still is available. Those fallbacks are not character animation.
- WebM export records the full storyboard sequentially and uses generated scene video clips when available. Timed dialogue and optional local music can be mixed into the final recording. The video-generation model outputs silent clips; lip-sync is not generated automatically.
- Voice synthesis, lip-sync, music generation, and production-grade audiovisual export are not implemented yet.
- No paid API is required.
- A successful CI run verifies syntax, unit tests, and bundling only; it does not prove physical-device rendering, playback, or audio/video codec support.



- The Hugging Face token is held only in the active page session and is not written to the draft or localStorage. The user must separately consent to uploading scene images and prompts to the public Space. Do not submit private or sensitive media.

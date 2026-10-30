# DRAVEX AI Cartoon Studio

A free-first prototype for turning story text into a structured storyboard. The app now includes an opt-in small local language model for experimental scene direction. Full AI-generated video, production voice synthesis, phoneme-level lip-sync, and production export are not yet integrated.

## Storyboard engine foundation

- `src/scene-model.js` normalizes current and legacy scene shapes into a predictable scene structure.
- `src/story-qa.js` performs deterministic text-level checks for missing actions, duplicate IDs, repetitive prompts, duration normalization, and dialogue/character mismatches. It does not inspect rendered video or claim model-level understanding.
- `src/scene-production.js` assembles separate still-image and motion prompts using camera direction, start/end states, negative constraints, and matching Character Bible entries.
- `src/device-capabilities.js` checks HTTPS, WebGPU adapter availability, WASM fallback, approximate browser memory, CPU threads, and browser storage before a local model load. This is advisory only; it does not guarantee model compatibility.
- `src/transformers-local-runtime.js` loads the approved `onnx-community/SmolLM2-135M-Instruct-ONNX` model through Transformers.js after explicit user consent. Model weights are downloaded from Hugging Face on first load; generation runs locally in the browser using WebGPU when available or WASM otherwise. The q4f16 weight file is approximately 117 MB; browser cache persistence depends on storage policy.
- `src/local-story-director.js` uses that local model to propose scene actions, camera directions, image/motion prompts, and continuity states. Source-story details, event order, and character membership are locked to the deterministic baseline. Candidate scenes must pass a text-level quality gate or DRAVEX keeps the deterministic fallback.
- `src/ai-horde-image-provider.js` optionally generates one still image through the free, volunteer-powered AI Horde queue. It sends text prompts only, never source photos or videos, and is gated by an explicit in-app consent checkbox.
- `src/image-frame.js` crops generated stills to the canvas aspect ratio without stretching. The browser loads images with anonymous CORS mode; if the image host does not permit canvas access, the procedural preview remains usable.
- `src/prompt-camera-motion.js` maps scene motion instructions such as push-in, pull-back, pan-left/right and tilt-up/down to bounded 2D camera moves on generated still images. It is prompt-guided still-image movement, not AI-generated video or character animation.
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

The Vite build is a separate development bundle. The root `index.html` is the published standalone workspace and now uses the deterministic director engine to vary preview framing from scene text and camera metadata. The storyboard is currently planned by a deterministic local engine; it is not yet a trained generative neural model.

## Current limitations

- Local story planning and cinematic direction use deterministic text heuristics; they do not visually understand generated frames.
- The deterministic planner remains the safe baseline. The optional SmolLM2 model is a small open-weight text model, not a model trained by DRAVEX; it may return weak or malformed output, which is rejected by the quality gate. It does not visually understand images or generate scene artwork/video.
- The scene editor exposes editable image/motion prompts, continuity locks, and a preview of the assembled AI instructions. The motion prompt now controls a limited 2D camera move on generated stills; full AI video generation and character animation remain unimplemented.
- The optional local AI hardware check does not prove that a particular language or diffusion model will fit or run on the device. Real Android performance and model quality still require device testing.
- AI Horde is a remote community queue, not local inference. Anonymous requests have low priority and may be slow; the service shares anonymous requests with LAION and may collect prompt and IP/usage data. The app requires explicit consent before sending a prompt. See the [AI Horde privacy policy](https://horde.aivo.chat/privacy).
- Generated AI Horde stills are now drawn into the selected scene's canvas preview and are included in the canvas-based WebM capture when the image host permits anonymous CORS access. The preview uses a subtle Ken Burns zoom. If CORS blocks drawing, the side preview remains available and the canvas falls back to its procedural scene; no tainted canvas is exported.
- The canvas preview uses procedural shapes and camera framing when no generated still is available; it is not full AI-generated animation.
- WebM export records the full storyboard sequentially, using each scene's duration (or the selected default). It remains a silent canvas recording without generated video motion, voice, music, or lip-sync.
- Voice synthesis, lip-sync, music generation, and production-grade audiovisual export are not implemented yet.
- No paid API is required.
- A successful CI run verifies syntax, unit tests, and bundling only; it does not prove physical-device rendering, playback, or audio/video codec support.



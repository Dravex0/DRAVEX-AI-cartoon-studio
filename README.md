# DRAVEX AI Cartoon Studio

A free-first prototype for turning story text into a structured storyboard. The current application UI is still a prototype; real AI video generation, voice synthesis, lip-sync, and production export are not yet integrated.

## Storyboard engine foundation

- `src/scene-model.js` normalizes current and legacy scene shapes into a predictable scene structure.
- `src/story-qa.js` performs deterministic text-level checks for missing actions, duplicate IDs, repetitive prompts, duration normalization, and dialogue/character mismatches. It does not inspect rendered video or claim model-level understanding.
- `src/scene-production.js` assembles separate still-image and motion prompts using camera direction, start/end states, negative constraints, and matching Character Bible entries.
- `src/device-capabilities.js` checks HTTPS, WebGPU adapter availability, approximate browser memory, CPU threads, and browser storage before any future local model load. This is advisory only; it does not download weights or guarantee model compatibility.
- `src/ai-horde-image-provider.js` optionally generates one still image through the free, volunteer-powered AI Horde queue. It sends text prompts only, never source photos or videos, and is gated by an explicit in-app consent checkbox.
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

The Vite build is a separate development bundle. The root `index.html` is the published standalone workspace and now uses the deterministic director engine to vary preview framing from scene text and camera metadata. The optional Gemini adapter can generate structured scene plans when a user supplies their own Free Tier API key.

## Current limitations

- Local story planning and cinematic direction use deterministic text heuristics; they do not visually understand generated frames.
- Gemini can optionally write storyboard scenes, but this does not generate scene artwork or animation.
- The scene editor exposes editable image/motion prompts, continuity locks, and a preview of the assembled AI instructions. These are pre-production instructions, not an active image/video generation provider.
- The optional local AI hardware check does not prove that a particular diffusion model will fit or run on the device.
- AI Horde is a remote community queue, not local inference. Anonymous requests have low priority and may be slow; the service shares anonymous requests with LAION and may collect prompt and IP/usage data. The app requires explicit consent before sending a prompt. See the [AI Horde privacy policy](https://horde.aivo.chat/privacy).
- Images returned by AI Horde are displayed beside the selected scene. The current WebM prototype export still records the procedural canvas only, not these generated images.
- The canvas preview uses procedural shapes and camera framing; it is not full AI-generated animation.
- Voice synthesis, lip-sync, music generation, and production-grade audiovisual export are not implemented yet.
- No paid API is required. Gemini is optional and limited to Google's Free Tier quota when configured.
- A successful CI run verifies syntax, unit tests, and bundling only; it does not prove mobile-device playback, audio/video codec support, or a live Gemini request.


## Optional Gemini integration (free tier only)

The storyboard workspace can optionally call the Gemini Developer API using the fixed `gemini-3.5-flash-lite` model. The local storyboard generator remains available without an API key.

1. Create an API key in [Google AI Studio](https://aistudio.google.com/apikey) under a project that remains on the **Free Tier**.
2. Do **not** link Cloud Billing or enable a paid tier.
3. Paste the key into the Gemini key field in the app when you want AI storyboard generation. The browser keeps it in page memory only; it is not saved in local storage.
4. Clear the field when finished. Never share the key in issues, screenshots, or chat.

Google's free tier has request quotas and may use submitted data to improve Google products. If the quota is exhausted, use the local generator and try Gemini again after the quota resets. No paid model fallback is configured.

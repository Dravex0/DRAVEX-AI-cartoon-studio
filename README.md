# DRAVEX AI Cartoon Studio

A free-first prototype for turning story text into a structured storyboard. The current application UI is still a prototype; real AI video generation, voice synthesis, lip-sync, and production export are not yet integrated.

## Storyboard engine foundation

- `src/scene-model.js` normalizes current and legacy scene shapes into a predictable scene structure.
- `src/story-qa.js` performs deterministic text-level checks for missing actions, duplicate IDs, repetitive prompts, duration normalization, and dialogue/character mismatches. It does not inspect rendered video or claim model-level understanding.
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

The Vite build is a separate development bundle; the current root `index.html` remains the existing standalone prototype until the new engine is deliberately connected to the UI.

## Current limitations

- Story analysis is rule-based QA, not an AI model.
- The fixture is test data, not a generated animation.
- No paid API is required by this test foundation.
- A successful CI run verifies syntax, unit tests, and bundling only; it does not prove mobile-browser playback, audio/video codec support, or real AI generation.

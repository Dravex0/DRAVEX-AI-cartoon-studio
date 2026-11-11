# DRAVEX Browser QA Agent

The free DRAVEX Browser QA Agent uses Playwright Chromium in GitHub Actions. It runs without paid APIs, provider tokens, sign-in, or remote AI generation consent.

## Two separate test targets

- **Source-build QA** opens the local Vite build. It checks the local storyboard/canvas path and verifies that a WebM can be downloaded and decoded.
- **Live Pages QA** opens the published production URL, enters a fixed Russian Foxy prompt, exports the result, and inspects the actual downloaded WebM. It runs on desktop Chromium and the Pixel 7 device profile.

The live test captures the prompt/result screenshots, several decoded video frames, the WebM itself, and a JSON report. FFprobe inspects the exported file's video/audio streams. The report records frame-to-frame pixel changes and a simple orange-pixel signal as hints only; these heuristics do not prove that Foxy is present or that the motion depicts the requested action. The attached frames must be visually reviewed for character identity and continuity.

## Honest result classifications

- `local-canvas-output-only-not-AI-video-generation`: the site exported its local canvas/storyboard output. This is not evidence of AI text-to-video.
- `completed-with-findings`: the browser completed the flow, but the report found missing audio, weak motion evidence, or other quality issues.
- `failed`: the live site could not be opened, generation/export did not complete, or the downloaded WebM could not be validated/decoded.

Audio-track presence is not proof of audible or intelligible Russian speech. A human listening check is still required. Likewise, orange pixels and pixel differences are not semantic computer vision and cannot certify a visible Foxy character. The report deliberately avoids marking these checks as passed merely because a WebM exists.

## Evidence

The GitHub Actions artifact `dravex-playwright-report` contains screenshots, frame samples, JSON reports, traces, recordings, and exported WebM files. Review the live Pages report and its attached frames, not only the green workflow status.

## Privacy and cost

The live QA test uses a synthetic prompt and the site's default local-canvas mode. It does not enter tokens, enable Hugging Face/AI Horde consent, or send the prompt/images to an AI video provider. GitHub Actions and Playwright are used as the free test runner within the repository's available CI quota.

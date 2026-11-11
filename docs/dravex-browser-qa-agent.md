# DRAVEX Browser QA Agent

The free DRAVEX Browser QA Agent uses Playwright Chromium in GitHub Actions. It runs without paid APIs, provider tokens, sign-in, or remote AI generation consent.

## Two separate test targets

- **Source-build QA** opens the local Vite build. It checks the local storyboard/canvas path and verifies that a WebM can be downloaded and decoded.
- **Live Pages QA** opens the published production URL, enters a fixed Russian Kael dark-fantasy anime prompt and saves an Kael Character Bible text profile, exports the result, and inspects the actual downloaded WebM. It runs on desktop Chromium and the Pixel 7 device profile.

The live test saves an Kael Character Bible text profile (appearance, clothing, colors and distinctive features), selects Anime-inspired style, then captures prompt/result screenshots, Chromium-player-decoded frames, FFmpeg-decoded frames from the downloaded WebM, the WebM itself, and a JSON report. The original character-sheet image is not uploaded to the public CI runner; image-reference fidelity is therefore not tested in this run. FFprobe inspects the exported file's video/audio streams, while packet timestamps and stream metadata are used to estimate duration. The test compares the SHA-256 hash of the preview Blob with the downloaded file so it can confirm the download is byte-for-byte the same output that the page previewed.

The agent computes frame-to-frame pixel-change ratios and simple pixel-change ratios as hints only. These measurements can be affected by camera movement, backgrounds, lighting, and compression; they do not recognize Kael, the cathedral, or any story action. Character identity and story-action accuracy remain manual-review items.

## Broad live Pages feature matrix

The live matrix runs against the published Pages site in addition to the focused prompt-to-WebM test. It checks:
- Workspace controls and feature inventory, interface language, story language, visual styles, scene duration, image-quality setting, and both 16:9 / 9:16 canvas formats.
- Storyboard creation, scene count, add/delete scene actions, selected-scene editing, and applying edits.
- Character Bible profile creation, draft save/reload persistence, local audio-file selection, and music-volume control.
- Local device capability diagnostics and the global animation / character-rig compatibility audit.
- Availability and consent gates for AI image generation, sprites, rig parts, Hugging Face, ComfyUI, local language models, face analysis, and lip-sync.

The matrix deliberately does not submit prompts to remote providers, enter tokens, grant external-service consent, or download large models. Those integrations are covered separately by mocked-provider integration tests and must be explicitly opted into for a real provider run. Presence of a control is not proof that the underlying remote service works. The report records this distinction and attaches a feature inventory.

## Honest result classifications

- `local-canvas-output-only-not-AI-video-generation`: the site exported its local canvas/storyboard output. This is not evidence of AI text-to-video.
- `completed-with-findings`: the browser completed the flow, but the report found missing audio, browser errors, or other quality issues.
- `completed-needs-manual-review`: the technical export completed without recorded findings, but the story and audio still require human review.
- `failed`: the live site could not be opened, generation/export did not complete, or the downloaded WebM could not be validated/decoded.

The JSON report separates technical checks from media quality:
- `quality.generationFlow`, `quality.webmExport`, and `quality.videoDecode` record technical evidence.
- `quality.audio` reports whether an audio stream exists; it does not claim the dialogue is audible or intelligible.
- `quality.storySemantics` remains `manual-review-required` and lists the expected Kael/cathedral/left-hand-mark/black-flame actions. The agent attaches decoded frames but does not pretend to understand their meaning.
- `summary` provides a short human-readable result so a green CI run cannot be mistaken for a finished cartoon.

Audio-track presence is not proof of audible or intelligible Russian speech. A human listening check is still required. Likewise, Pixel differences are not semantic computer vision and cannot certify Kael's identity or story actions. The report deliberately avoids marking these checks as passed merely because a WebM exists.

## Evidence

The GitHub Actions artifact `dravex-playwright-report` contains screenshots, Chromium and FFmpeg frame samples, the JSON report in the test-results folder, traces, recordings, and exported WebM files. Review the live Pages report and its attached frames, not only the green workflow status.

## Privacy and cost

The live QA test uses a synthetic prompt and the site's default local-canvas mode. It does not enter tokens, enable Hugging Face/AI Horde consent, or send the prompt/images to an AI video provider. GitHub Actions and Playwright are used as the free test runner within the repository's available CI quota.


## Kael Vorran anime test

The fixed live Pages prompt is KAEL VORRAN — The Shadow Crown: dark-fantasy anime, 9:16, 15–20 seconds, black tactical cloak with red details and broken-crown emblem, scarlet eyes, Shadow Blade. The test saves a text profile and exercises the local prompt-to-WebM flow. The original user image is mandatory for image-conditioned generation but is not available to the CI runner. The report must say referenceImageUsed=false and mark image likeness as blocked; it must never claim an image-based anime was generated until the original image is attached to the Character Bible reference-image input and the run is repeated.

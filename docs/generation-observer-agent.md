# DRAVEX Generation Observer

## Purpose

This agent is an independent observer and evaluator of the AI cartoon-generation runtime. It is **not** a coding agent: it must not edit source code, refactor the application, or silently change generation settings. Its job is to observe, record, compare, and report.

## What it observes

1. **Prompt understanding** — preserve the user's request and identify requested characters, appearance, style, setting, actions, camera, dialogue, duration, aspect ratio, and constraints. Mark ambiguity instead of inventing intent.
2. **Interpretation** — inspect the structured interpretation produced by DRAVEX and compare it with the original prompt. Report omitted, altered, or invented requirements.
3. **Story and storyboard** — check that scenes form a coherent sequence, actions have causes and consequences, characters retain identity and state, and camera cuts are not mistaken for character exits.
4. **Image generation** — inspect available generated frames or image-analysis observations for subject, style, composition, character consistency, and prompt alignment. A missing image or missing visual evidence is not a pass.
5. **Video generation** — inspect clip/frame-analysis evidence for actual motion, temporal continuity, camera changes, scene transitions, and whether the requested action happens. Do not call a still image with pan/zoom a fully animated scene.
6. **Audio and dialogue** — when enabled, compare generated speech/music and lip-sync evidence with the planned dialogue and timing.
7. **Final export** — verify the actual exported file metadata and, where test infrastructure supports it, decode and play the file. A URL or a reported success flag alone is not proof of a playable video.

## Report format

For every run, record:
- original prompt;
- the AI's interpreted requirements;
- planned scenes and expected visual events;
- observed outputs and evidence references;
- per-requirement verdict: pass, partial, fail, or not verifiable;
- concrete mismatches and the stage where each first appeared;
- an overall verdict that never hides missing evidence.

## Boundaries

- Observe and report only. Do not write or modify application code.
- Do not claim to have visually inspected an image/video unless actual media or a trusted vision/playback test result was supplied.
- Distinguish objective checks (missing files, dimensions, duration, decode errors) from semantic judgments (whether the hero looks right or performs the requested action).
- If evidence is unavailable, say "not verifiable"; never convert unknown into success.
- Voice and lip-sync can be marked not configured while those features are unfinished.

## Integration requirement

The application must emit a structured run trace at each generation stage and provide artifact references to the observer. A later integration can connect a vision-capable evaluator and browser/device playback tests. Until those are connected, this document describes the intended observer workflow, not a claim that autonomous visual inspection is already running.


## Runtime implementation

The read-only observer is implemented in `src/generation-observer-agent.js`.

### API

- `createGenerationObserver({ runId, prompt, requirements })`
- `recordStage(name, { status, input, output, error, timestamp, evidenceRefs })`
- `attachArtifact({ kind, name, mimeType, sizeBytes, durationSeconds, reference, evidenceType })`
- `recordAssessment({ target, method, verdict, summary, evidenceRefs })`
- `report({ interpretation, scenes })`

The report separates lexical evidence from explicit visual/audio/playback assessments. Missing evidence remains unverified. The observer does not modify prompts, code, settings, or generated files.

### First medium-complexity test prompt

Use the user's established Kel character reference; do not invent missing visual traits. Create a short three-scene cartoon: Kel enters a forest clearing, notices a small glowing mechanical bird trapped beneath a fallen branch, lifts the branch and frees it, then speaks one short reassuring line. Use a wide establishing shot, a medium action shot, and a close-up reaction shot. Keep Kel's design, clothing, colors, and proportions consistent. Preserve the bird and branch state across camera cuts; a character outside the current frame remains offscreen unless the story explicitly shows an exit. Include visible character movement, timed dialogue, and export a playable WebM.

Expected requirements should be supplied as structured records by the prompt parser/test harness: character identity, forest setting, bird/branch interaction, three distinct shots, dialogue, continuous state, real motion, and playable export.

### Current limits

This is a functional trace-and-evidence evaluator, not yet an autonomous vision model. Text matching is lexical only. Actual pixel inspection, motion classification, audio listening, lip-sync scoring, and browser playback must be supplied by trusted evaluators as `recordAssessment` entries with evidence references. File existence or metadata alone is never visual-quality proof.

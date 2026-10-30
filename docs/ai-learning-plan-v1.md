# DRAVEX AI Learning & Evaluation Plan — v1

## Why evaluation comes before training

The current storyboard planner is deterministic and rule-based. It is not a trained neural network. Before training or integrating any model, DRAVEX needs a repeatable benchmark so that improvements can be measured instead of guessed.

## First curriculum

`fixtures/ai-curriculum-v1.js` starts with Russian, Ukrainian, and English story examples. Each case identifies the expected scene count, source-story details that must survive exactly once, and the skills under test.

`src/ai-evaluation.js` scores only verifiable text-level properties:
- requested storyboard structure;
- specific visible actions;
- action diversity;
- camera-plan variety;
- source-story fidelity;
- optional explicit character membership;
- optional scene-production field completeness;
- optional scene-state coverage and adjacent-scene state hand-offs;
- optional character-reference ID coverage against the Character Bible.

`src/scene-continuity.js` adds a separate continuity report and can be enabled inside `evaluateStoryboard` with `requireContinuity: true`. It checks written state notes and character IDs only; it does not compare rendered faces, clothing, or animation frames. Text similarity can miss valid paraphrases, so low scores are review flags rather than proof of a continuity error.

A metric is `null` when the current sample does not provide enough evidence. The evaluator does not infer image quality, emotional truth, visual character identity, animation quality, or whether a generated video looks correct.

## Story-aware direction engine

`src/story-event-director.js` now classifies common source-story events in Russian, Ukrainian, English, and Spanish (discovery, repair/build, guidance, threat/conflict, transformation, travel, and emotional reaction). The storyboard planner uses the event type to choose a more relevant visible action and camera plan instead of always using the same generic beat direction. Unknown events use an explicit general fallback. This is a transparent multilingual rule engine, not neural semantic understanding; benchmark examples must be expanded as new story patterns are added.

## Story chronology benchmark

The evaluator now checks not only whether required source-story details survive, but also whether they remain assigned to scenes in the original order. Chronology is scored only when each expected detail maps to exactly one scene; missing or duplicated details make the chronology metric unavailable rather than producing a misleading score. The starter curriculum now includes additional Russian, Ukrainian, English, and Spanish cases for conflict, escape, repair, guidance, discovery, and transformation. These remain deterministic text benchmarks, not proof of semantic understanding.

## Learning safety gate

`src/learning-governor.js` compares baseline and candidate benchmark reports skill by skill. A candidate that improves the average but damages a measured skill is blocked. A proposal remains pending until a person explicitly approves it; only an approved proposal can create a version record, and older version records can be selected as rollback targets. This governs evaluation and approval; it does not itself fine-tune or train a neural network.

## Local model integration contract

`src/local-model-contract.js` defines the manifest and adapter boundary for a future WebGPU/WASM model: supported tasks, model files, license, declared local-only behavior, device-fit estimates, cancellation, and structured JSON output. The adapter accepts an injected inference runner; it does not bundle model weights or an inference runtime. The runner is trusted code, so this contract alone cannot prove that a third-party runner never uses the network. No neural model is installed or running yet.

## Training loop to build next

1. **Collect examples:** user-approved story prompts and corrected storyboards, with private details removed.
2. **Label target behavior:** plot beats, action, camera, character presence, dialogue intent, continuity states, and visual references.
3. **Run the benchmark:** record baseline scores for every supported language and content category.
4. **Improve one skill at a time:** update deterministic planning first; later evaluate a small open-weight model that can run locally on supported hardware.
5. **Compare before/after:** reject changes that improve one category while damaging others.
6. **Keep verified learning:** store approved examples and versioned evaluation reports; never silently train on user content.
7. **Visual validation:** add human-reviewed reference frames and Android playback checks before claiming image/video understanding.

## Target competency map

- Story understanding and plot structure
- Scene decomposition and pacing
- Visible action and physical cause/effect
- Camera framing, movement, and shot variety
- Character Bible and appearance continuity
- Environment, props, lighting, and style consistency
- Dialogue, voice direction, and lip-sync timing
- Animation timing, anticipation, action, and recovery
- Music, sound effects, and scene rhythm
- Render quality, editing, and final export

## Constraints

- Free-first and local-first; no mandatory paid API or cloud AI.
- External inference is never silently enabled.
- User media and corrections are not sent to a service or used for training without explicit consent.
- A local rules engine, an open-weight model, and a trained DRAVEX model are different things; the project must label them accurately.
- No self-training on production data without a curated dataset, evaluation, rollback, and user approval.

## Verification

Run `npm run check`, `npm test`, and `npm run build`. CI success verifies code behavior and bundle generation, not real visual quality or local model performance.

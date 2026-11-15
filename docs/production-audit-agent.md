# DRAVEX Production Audit Agent

The production audit agent is a deterministic, evidence-based reviewer for a captured DRAVEX run. It is separate from the Story Director: the Director proposes scenes; the auditor checks whether each pipeline stage reports a result and supplies evidence.

## Coverage

1. Prompt received (promptInput)
2. Prompt parsed (promptParsing)
3. Story planned (storyPlanning)
4. Storyboard validated (storyboardValidation)
5. Still images generated (imageGeneration)
6. Video clips generated (videoGeneration)
7. Voice generated (voiceGeneration; optional while voice is unfinished)
8. Lip-sync generated (lipSync; optional while lip-sync is unfinished)
9. Final export (export)

Each stage record uses a status such as completed, failed, skipped, pending, or not-configured, plus output evidence or an error. Missing evidence is reported as unknown or warning, never silently counted as success.

## Use

    import { auditProductionRun } from "./src/production-audit-agent.js";
    const report = auditProductionRun({
      runId: "test-run-001",
      stages: {
        promptInput: { status: "completed", output: "A hero enters a forest" },
        promptParsing: { status: "completed", output: { normalizedPrompt: "..." } },
        storyPlanning: { status: "completed", output: [{ id: "scene-1" }] },
        storyboardValidation: { status: "completed", output: { ok: true } },
        imageGeneration: { status: "completed", output: { imageId: "image-1" } },
        videoGeneration: { status: "failed", error: "Provider timeout" },
        export: { status: "pending" }
      }
    });

The report identifies failed, skipped, pending, and unverified stages. For export to count as independently evidenced, supply artifact metadata with a filename and positive size in bytes.

## Important limits

This module audits records supplied by the application; it does not itself drive the browser, execute a generation provider, inspect image pixels, listen to audio, or decode/play a WebM. Browser automation, device playback, and human visual review remain separate test layers. A green report must not be presented as proof that a cartoon looks good or that an AI understood the story.

## Character presence companion

src/character-presence-tracker.js tracks visible, offscreen, and exited. A camera cut or missing character from a frame changes a visible character to offscreen; only an explicit narrative exit marks it exited. This is a narrative-state tracker, not computer vision. The caller must provide observed visible IDs and explicit story events.

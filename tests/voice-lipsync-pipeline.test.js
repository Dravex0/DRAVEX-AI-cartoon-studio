import test from "node:test";
import assert from "node:assert/strict";
import { buildTimestampedKokoroVisemeEvents } from "../src/timestamped-kokoro-viseme-adapter.js";
import { buildSceneVoiceTimeline } from "../src/scene-voice-workflow.js";
import { buildVisemeTimeline, sampleVisemeTimeline } from "../src/viseme-timeline.js";

const hash = "a".repeat(64);

test("model-derived Kokoro visemes survive scene scheduling and reach mouth-frame sampling", () => {
  const modelEvents = buildTimestampedKokoroVisemeEvents({
    visemes: ["PP", "aa", "O"],
    vtimes: [0, 150, 350],
    vdurations: [150, 200, 150],
    durationMs: 500
  });

  const scheduled = buildSceneVoiceTimeline({
    sceneId: "lip-sync-integration",
    fps: 24,
    gapMs: 120,
    dialogue: [{ characterId: "Foxy", text: "Hello", language: "en" }],
    artifacts: [{
      audioHash: hash,
      durationMs: 500,
      visemeEvents: modelEvents
    }]
  });

  const cue = scheduled.cues[0];
  assert.deepEqual(cue.visemeEvents, modelEvents);

  const timeline = buildVisemeTimeline({
    text: cue.text,
    durationMs: cue.durationMs,
    language: cue.language,
    fps: 24,
    phonemeChunks: cue.phonemeChunks,
    visemeEvents: cue.visemeEvents
  });

  assert.equal(timeline.source, "timestamped-kokoro-viseme-events");
  assert.equal(sampleVisemeTimeline(timeline, 50), "closed");
  assert.equal(sampleVisemeTimeline(timeline, 200), "open");
  assert.equal(sampleVisemeTimeline(timeline, 400), "round");
  assert.equal(sampleVisemeTimeline(timeline, 500), "neutral");
});

test("scene scheduling retains the approximate fallback when no model visemes are supplied", () => {
  const scheduled = buildSceneVoiceTimeline({
    sceneId: "lip-sync-fallback",
    dialogue: [{ characterId: "Foxy", text: "A O", language: "en" }],
    artifacts: [{ audioHash: hash, durationMs: 800 }]
  });
  const cue = scheduled.cues[0];
  const timeline = buildVisemeTimeline({
    text: cue.text,
    durationMs: cue.durationMs,
    language: cue.language,
    fps: 24,
    visemeEvents: cue.visemeEvents
  });
  assert.equal(timeline.source, "text-grapheme-fallback");
  assert.equal(timeline.alignment, "approximate-text-distribution");
});

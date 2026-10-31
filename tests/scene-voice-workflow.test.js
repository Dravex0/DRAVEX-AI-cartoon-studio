import test from "node:test";
import assert from "node:assert/strict";
import { assignCharacterVoices, buildSceneVoiceTimeline, normalizeSpeakerKey } from "../src/scene-voice-workflow.js";

const hash = char => char.repeat(64).slice(0, 64);

test("normalizes speaker identity consistently", () => {
  assert.equal(normalizeSpeakerKey("  Foxy   "), "foxy");
});

test("assigns deterministic distinct voices and keeps existing character assignments", () => {
  const voices = ["voice-a", "voice-b", "voice-c"];
  const first = assignCharacterVoices({ speakers: ["Foxy", "Narrator"], availableVoices: voices });
  const second = assignCharacterVoices({
    speakers: ["Bird", "Foxy", "Narrator"],
    availableVoices: voices,
    existingAssignments: first
  });
  assert.equal(second.foxy, first.foxy);
  assert.equal(second.narrator, first.narrator);
  assert.ok(second.bird);
  assert.notEqual(second.foxy, second.narrator);
  assert.deepEqual(
    assignCharacterVoices({ speakers: ["Narrator", "Foxy"], availableVoices: voices }),
    first
  );
});

test("falls back safely for single-speaker engines without a voice catalog", () => {
  const result = assignCharacterVoices({
    speakers: ["Foxy", "Narrator"],
    availableVoices: [],
    fallbackVoiceId: "default"
  });
  assert.equal(result.foxy, "default");
  assert.equal(result.narrator, "default");
});

test("replaces stale voice IDs when the installed voice catalog changes", () => {
  const result = assignCharacterVoices({
    speakers: ["Foxy"],
    availableVoices: ["voice-new"],
    existingAssignments: { foxy: "voice-removed" }
  });
  assert.equal(result.foxy, "voice-new");
});

test("builds scene timeline from measured WAV durations, not text length", () => {
  const result = buildSceneVoiceTimeline({
    sceneId: "scene-1",
    fps: 24,
    gapMs: 100,
    dialogue: [
      { characterId: "Foxy", text: "Hi", language: "en" },
      { characterId: "Narrator", text: "A much longer sentence.", language: "en" }
    ],
    artifacts: [
      { audioHash: hash("a"), durationMs: 1250, voiceId: "voice-a" },
      { audioHash: hash("b"), durationMs: 800, voiceId: "voice-b" }
    ]
  });
  assert.equal(result.cues[0].startFrame, 0);
  assert.equal(result.cues[0].durationMs, 1250);
  assert.equal(result.cues[1].startFrame, 33);
  assert.equal(result.cues[1].durationMs, 800);
  assert.equal(result.timeline.tracks[1].audioHash, hash("b"));
  assert.ok(result.timeline.totalDurationMs >= 2050);
});

test("rejects missing artifacts, invalid hashes and unmeasured durations", () => {
  const dialogue = [{ characterId: "Foxy", text: "Hello" }];
  assert.throws(() => buildSceneVoiceTimeline({
    sceneId: "s1", dialogue, artifacts: []
  }), /exactly one/);
  assert.throws(() => buildSceneVoiceTimeline({
    sceneId: "s1", dialogue, artifacts: [{ audioHash: "bad", durationMs: 100 }]
  }), /SHA-256/);
  assert.throws(() => buildSceneVoiceTimeline({
    sceneId: "s1", dialogue, artifacts: [{ audioHash: hash("c"), durationMs: 0 }]
  }), /measured durationMs/);
});

test("rejects invalid scene and timing options", () => {
  assert.throws(() => buildSceneVoiceTimeline({
    sceneId: "", dialogue: [], artifacts: []
  }), /sceneId/);
  assert.throws(() => buildSceneVoiceTimeline({
    sceneId: "s1", dialogue: [{ text: "Hi" }],
    artifacts: [{ audioHash: hash("d"), durationMs: 100 }], fps: 0
  }), /fps/);
});

test("treats special property names as ordinary speaker IDs", () => {
  const result = assignCharacterVoices({
    speakers: ["__proto__", "constructor"],
    availableVoices: ["voice-a", "voice-b"]
  });
  assert.equal(Object.getPrototypeOf(result), null);
  assert.equal(Object.hasOwn(result, "__proto__"), true);
  assert.equal(Object.hasOwn(result, "constructor"), true);
});

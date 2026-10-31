import test from "node:test";
import assert from "node:assert/strict";
import { buildVisemeTimeline, sampleVisemeTimeline } from "../src/viseme-timeline.js";

test("English vowels produce distinct open, wide and rounded viseme classes", () => {
  const timeline = buildVisemeTimeline({ text: "A E O", durationMs: 3000, fps: 10 });
  assert.ok(timeline.frames.includes("open"));
  assert.ok(timeline.frames.includes("wide"));
  assert.ok(timeline.frames.includes("round"));
});

test("Russian and Ukrainian vowels map to language-appropriate broad mouth shapes", () => {
  const ru = buildVisemeTimeline({ text: "А И О", durationMs: 3000, language: "ru", fps: 10 });
  const uk = buildVisemeTimeline({ text: "А І У", durationMs: 3000, language: "uk", fps: 10 });
  assert.ok(ru.frames.includes("open"));
  assert.ok(ru.frames.includes("wide"));
  assert.ok(ru.frames.includes("round"));
  assert.ok(uk.frames.includes("open"));
  assert.ok(uk.frames.includes("wide"));
  assert.ok(uk.frames.includes("round"));
});

test("bilabial and labiodental consonants select closed and teeth shapes", () => {
  const timeline = buildVisemeTimeline({ text: "M F", durationMs: 2000, fps: 12 });
  assert.ok(timeline.frames.includes("closed"));
  assert.ok(timeline.frames.includes("teeth"));
});

test("viseme sampling clamps outside the dialogue interval", () => {
  const timeline = buildVisemeTimeline({ text: "AOU", durationMs: 1000, fps: 24 });
  assert.equal(sampleVisemeTimeline(timeline, -1), "neutral");
  assert.equal(sampleVisemeTimeline(timeline, 1000), "neutral");
  assert.ok(["open", "round"].includes(sampleVisemeTimeline(timeline, 0)));
});

test("viseme timeline rejects invalid text, duration, frame rate and oversized input", () => {
  assert.throws(() => buildVisemeTimeline({ text: "", durationMs: 1000 }), /text/);
  assert.throws(() => buildVisemeTimeline({ text: "Hi", durationMs: 0 }), /durationMs/);
  assert.throws(() => buildVisemeTimeline({ text: "Hi", durationMs: 1000, fps: 0 }), /fps/);
  assert.throws(() => buildVisemeTimeline({ text: "x".repeat(2001), durationMs: 1000 }), /graphemes/);
});


test("uses measured Kokoro chunk boundaries and broad IPA phoneme classes", () => {
  const timeline = buildVisemeTimeline({
    text: "hello world",
    durationMs: 1000,
    fps: 24,
    phonemeChunks: [
      { phonemes: "aɪ", startMs: 0, endMs: 450 },
      { phonemes: "bmp", startMs: 450, endMs: 1000 }
    ]
  });
  assert.equal(timeline.source, "kokoro-phoneme-chunks");
  assert.equal(timeline.alignment, "measured-chunk-bounds-with-approximate-within-chunk-phoneme-timing");
  assert.ok(timeline.frames.slice(0, 10).includes("open"));
  assert.ok(timeline.frames.slice(0, 10).includes("wide"));
  assert.ok(timeline.frames.slice(11).includes("closed"));
});

test("falls back to text timing when Kokoro phoneme chunks are absent", () => {
  const timeline = buildVisemeTimeline({ text: "A E O", durationMs: 1000, fps: 24 });
  assert.equal(timeline.source, "text-grapheme-fallback");
  assert.ok(timeline.frames.includes("open"));
});

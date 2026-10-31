import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAudioTimeline } from '../src/audio-timeline.js';

test('places each audio cue at its exact frame-derived start time', () => {
  const result = buildAudioTimeline([
    { cueId: 'a', characterName: 'Mira', startFrame: 24, durationMs: 1250, audioHash: 'abc' },
    { cueId: 'b', characterName: 'Kai', startFrame: 60, durationMs: 500 }
  ], 24);

  assert.equal(result.tracks[0].startMs, 1000);
  assert.equal(result.tracks[0].endMs, 2250);
  assert.equal(result.tracks[0].endFrame, 54);
  assert.equal(result.tracks[0].audioHash, 'abc');
  assert.equal(result.totalFrames, 72);
  assert.equal(result.totalDurationMs, 3000);
});

test('detects every overlapping pair and reports character names and interval', () => {
  const result = buildAudioTimeline([
    { cueId: 'a', characterName: 'Mira', startFrame: 0, durationMs: 2000 },
    { cueId: 'b', characterName: 'Kai', startFrame: 24, durationMs: 1500 },
    { cueId: 'c', characterName: 'Narrator', startFrame: 48, durationMs: 1000 }
  ], 24);

  assert.deepEqual(result.overlaps.map(item => [item.cueA, item.cueB]), [
    ['a', 'b'],
    ['b', 'c']
  ]);
  assert.equal(result.overlaps[0].startMs, 1000);
  assert.equal(result.overlaps[0].endMs, 2000);
  assert.equal(result.overlaps[0].durationMs, 1000);
});

test('treats touching interval boundaries as non-overlapping', () => {
  const result = buildAudioTimeline([
    { cueId: 'a', characterName: 'Mira', startFrame: 0, durationMs: 1000 },
    { cueId: 'b', characterName: 'Kai', startFrame: 24, durationMs: 500 }
  ], 24);
  assert.deepEqual(result.overlaps, []);
});

test('returns an empty deterministic timeline', () => {
  assert.deepEqual(buildAudioTimeline([], 30), {
    fps: 30,
    tracks: [],
    overlaps: [],
    totalFrames: 0,
    totalDurationMs: 0
  });
});

test('rejects invalid FPS and malformed cue timing', () => {
  for (const fps of [0, -1, NaN, Infinity, 61]) {
    assert.throws(() => buildAudioTimeline([], fps), /fps/);
  }
  assert.throws(() => buildAudioTimeline([{
    cueId: 'a', characterName: 'Mira', startFrame: -1, durationMs: 100
  }]), /startFrame/);
  assert.throws(() => buildAudioTimeline([{
    cueId: 'a', characterName: 'Mira', startFrame: 0, durationMs: 0
  }]), /durationMs/);
});

test('rejects duplicate cue IDs and missing speaker identity', () => {
  assert.throws(() => buildAudioTimeline([
    { cueId: 'same', characterName: 'Mira', startFrame: 0, durationMs: 100 },
    { cueId: 'same', characterName: 'Kai', startFrame: 1, durationMs: 100 }
  ]), /Duplicate audio cueId/);
  assert.throws(() => buildAudioTimeline([
    { cueId: 'a', characterName: ' ', startFrame: 0, durationMs: 100 }
  ]), /characterName/);
});

test('rejects more cues than the scene dialogue editor supports', () => {
  const cues = Array.from({ length: 31 }, (_, index) => ({
    cueId: String(index),
    characterName: 'Narrator',
    startFrame: index,
    durationMs: 100
  }));
  assert.throws(() => buildAudioTimeline(cues), /at most 30 cues/);
});

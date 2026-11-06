import test from "node:test";
import assert from "node:assert/strict";
import { buildLipSyncQualityReport } from "../src/lip-sync-quality-report.js";

test("reports timestamped, chunk-guided and approximate lip-sync separately", () => {
  const report = buildLipSyncQualityReport({
    voiceTracks: [{}, {}, {}],
    eligibleTrackCount: 3,
    analyzedTracks: [
      { visemes: { alignment: "model-token-duration-derived-viseme-timestamps" } },
      { visemes: { alignment: "measured-chunk-bounds-with-approximate-within-chunk-phoneme-timing" } },
      { visemes: { alignment: "approximate-text-distribution" } }
    ]
  });
  assert.deepEqual(report, {
    voiceTrackCount: 3,
    eligibleTrackCount: 3,
    analyzedTrackCount: 3,
    skippedTrackCount: 0,
    notSelectedTrackCount: 0,
    modelTimestampedTrackCount: 1,
    chunkGuidedTrackCount: 1,
    approximateTrackCount: 1
  });
  assert.equal(Object.isFrozen(report), true);
});

test("does not count unselected or skipped dialogue as analyzed", () => {
  const report = buildLipSyncQualityReport({
    voiceTracks: [{}, {}, {}, {}],
    eligibleTrackCount: 3,
    analyzedTracks: [{ visemes: { alignment: "approximate-text-distribution" } }],
    skippedTracks: 1
  });
  assert.equal(report.notSelectedTrackCount, 1);
  assert.equal(report.skippedTrackCount, 2);
  assert.equal(report.analyzedTrackCount, 1);
});

test("rejects impossible report inputs", () => {
  assert.throws(() => buildLipSyncQualityReport({ voiceTracks: {}, analyzedTracks: [] }), /arrays/);
  assert.throws(() => buildLipSyncQualityReport({ voiceTracks: [{}], eligibleTrackCount: 2 }), /within voiceTracks/);
  assert.throws(() => buildLipSyncQualityReport({ voiceTracks: [{}], skippedTracks: -1 }), /non-negative/);
});

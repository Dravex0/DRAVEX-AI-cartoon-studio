/**
 * Summarize what the export actually analyzed without implying that every
 * spoken line has phoneme-level alignment or a renderable facial rig.
 */
export function buildLipSyncQualityReport({
  voiceTracks = [],
  eligibleTrackCount = 0,
  analyzedTracks = [],
  skippedTracks = 0
} = {}) {
  if (!Array.isArray(voiceTracks) || !Array.isArray(analyzedTracks)) {
    throw new TypeError("voiceTracks and analyzedTracks must be arrays.");
  }
  const eligible = Number(eligibleTrackCount);
  const skipped = Number(skippedTracks);
  if (!Number.isInteger(eligible) || eligible < 0 || eligible > voiceTracks.length) {
    throw new RangeError("eligibleTrackCount must be an integer within voiceTracks.");
  }
  if (!Number.isInteger(skipped) || skipped < 0) {
    throw new RangeError("skippedTracks must be a non-negative integer.");
  }
  const modelTimestampedTrackCount = analyzedTracks.filter(track =>
    track?.visemes?.alignment === "model-token-duration-derived-viseme-timestamps"
  ).length;
  const chunkGuidedTrackCount = analyzedTracks.filter(track =>
    track?.visemes?.alignment === "measured-chunk-bounds-with-approximate-within-chunk-phoneme-timing"
  ).length;
  const approximateTrackCount = analyzedTracks.filter(track =>
    track?.visemes?.alignment === "approximate-text-distribution"
  ).length;
  const skippedTrackCount = Math.max(skipped, eligible - analyzedTracks.length);
  return Object.freeze({
    voiceTrackCount: voiceTracks.length,
    eligibleTrackCount: eligible,
    analyzedTrackCount: analyzedTracks.length,
    skippedTrackCount,
    notSelectedTrackCount: Math.max(0, voiceTracks.length - eligible),
    modelTimestampedTrackCount,
    chunkGuidedTrackCount,
    approximateTrackCount
  });
}

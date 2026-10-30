const isScore = value => typeof value === 'number' && Number.isFinite(value);

function cleanLabel(value, max = 160) {
  return String(value ?? '').trim().slice(0, max);
}

/**
 * Compare two benchmark reports without hiding per-skill regressions.
 * Metrics that are null or absent in either report are not compared.
 */
export function compareBenchmarkReports(baseline, candidate, { maxRegression = 0 } = {}) {
  const before = baseline && typeof baseline === 'object' ? baseline : {};
  const after = candidate && typeof candidate === 'object' ? candidate : {};
  const beforeMetrics = before.metrics && typeof before.metrics === 'object' ? before.metrics : {};
  const afterMetrics = after.metrics && typeof after.metrics === 'object' ? after.metrics : {};
  const metricNames = [...new Set([...Object.keys(beforeMetrics), ...Object.keys(afterMetrics)])];
  const metricDeltas = metricNames
    .filter(name => isScore(beforeMetrics[name]) && isScore(afterMetrics[name]))
    .map(name => ({
      skill: name,
      before: beforeMetrics[name],
      after: afterMetrics[name],
      delta: Number((afterMetrics[name] - beforeMetrics[name]).toFixed(2))
    }));
  const regressions = metricDeltas.filter(item => item.delta < -Math.max(0, Number(maxRegression) || 0));
  const improvements = metricDeltas.filter(item => item.delta > 0);
  const overallDelta = isScore(before.overallScore) && isScore(after.overallScore)
    ? Number((after.overallScore - before.overallScore).toFixed(2))
    : null;

  let status = 'insufficient-data';
  if (overallDelta !== null && metricDeltas.length) {
    if (regressions.length) status = 'regression';
    else if (overallDelta > 0) status = 'improved';
    else if (overallDelta < 0) status = 'regression';
    else if (improvements.length) status = 'mixed';
    else status = 'unchanged';
  }

  return {
    schemaVersion: 1,
    status,
    baselineScore: isScore(before.overallScore) ? before.overallScore : null,
    candidateScore: isScore(after.overallScore) ? after.overallScore : null,
    overallDelta,
    comparedMetricCount: metricDeltas.length,
    metricDeltas,
    improvements,
    regressions,
    eligibleForHumanApproval: status === 'improved' && regressions.length === 0,
    automaticPromotion: false,
    limitations: [
      'Only numeric metrics present in both reports are compared.',
      'A benchmark improvement does not prove better visual output unless the benchmark includes human-reviewed visual results.',
      'The governor never trains, deploys, or promotes a model automatically.'
    ]
  };
}

/** Create a pending proposal; benchmark gains are never auto-approved. */
export function createLearningProposal({
  proposalId,
  changeSummary,
  baselineReport,
  candidateReport,
  exampleIds = [],
  maxRegression = 0
} = {}) {
  const id = cleanLabel(proposalId, 120);
  const summary = cleanLabel(changeSummary, 1_000);
  if (!id) throw new TypeError('A proposal ID is required.');
  if (!summary) throw new TypeError('A change summary is required.');
  const comparison = compareBenchmarkReports(baselineReport, candidateReport, { maxRegression });
  return {
    schemaVersion: 1,
    proposalId: id,
    changeSummary: summary,
    exampleIds: [...new Set((Array.isArray(exampleIds) ? exampleIds : []).map(value => cleanLabel(value, 120)).filter(Boolean))],
    comparison,
    status: 'pending-human-approval',
    approvedBy: null,
    resolvedAt: null
  };
}

/** Explicit approval is required, and regressions block promotion even after approval is requested. */
export function resolveLearningProposal(proposal, { approved = false, reviewer = 'user' } = {}) {
  const source = proposal && typeof proposal === 'object' ? proposal : {};
  if (source.status !== 'pending-human-approval') {
    throw new Error('Only a pending learning proposal can be resolved.');
  }
  const eligible = source.comparison?.eligibleForHumanApproval === true;
  if (approved !== true) {
    return { ...source, status: 'rejected', approvedBy: null, resolvedAt: 'reviewed' };
  }
  if (!eligible) {
    return { ...source, status: 'blocked-by-evaluation', approvedBy: null, resolvedAt: 'reviewed' };
  }
  const approver = cleanLabel(reviewer, 120);
  if (!approver) throw new TypeError('A reviewer ID is required for approval.');
  return { ...source, status: 'approved', approvedBy: approver, resolvedAt: 'reviewed' };
}

/** A version can only be created from a proposal that passed evaluation and was explicitly approved. */
export function createLearningVersion({ versionId, proposal, parentVersionId = null } = {}) {
  const id = cleanLabel(versionId, 120);
  if (!id) throw new TypeError('A learning version ID is required.');
  if (proposal?.status !== 'approved') {
    throw new Error('Only an explicitly approved learning proposal can create a version.');
  }
  return {
    schemaVersion: 1,
    versionId: id,
    parentVersionId: cleanLabel(parentVersionId, 120) || null,
    proposalId: proposal.proposalId,
    changeSummary: proposal.changeSummary,
    exampleIds: Array.isArray(proposal.exampleIds) ? proposal.exampleIds.slice() : [],
    benchmark: proposal.comparison,
    createdBy: proposal.approvedBy
  };
}

/** Return a known immutable version as the rollback target; never mutate history. */
export function findRollbackTarget(history, versionId) {
  const entries = Array.isArray(history) ? history : [];
  const target = entries.find(entry => entry?.versionId === versionId);
  return target ? { ...target } : null;
}

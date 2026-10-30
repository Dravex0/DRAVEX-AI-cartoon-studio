import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareBenchmarkReports,
  createLearningProposal,
  resolveLearningProposal,
  createLearningVersion,
  findRollbackTarget
} from '../src/learning-governor.js';

test('allows a proposal for review when the overall score improves without skill regressions', () => {
  const comparison = compareBenchmarkReports(
    { overallScore: 70, metrics: { story: 70, action: 60, camera: 80 } },
    { overallScore: 78, metrics: { story: 80, action: 70, camera: 84 } }
  );
  assert.equal(comparison.status, 'improved');
  assert.equal(comparison.eligibleForHumanApproval, true);
  assert.equal(comparison.automaticPromotion, false);
});

test('blocks a higher overall score when any measured skill regresses', () => {
  const comparison = compareBenchmarkReports(
    { overallScore: 70, metrics: { story: 70, action: 80, camera: 70 } },
    { overallScore: 75, metrics: { story: 90, action: 60, camera: 75 } }
  );
  assert.equal(comparison.status, 'regression');
  assert.equal(comparison.eligibleForHumanApproval, false);
  assert.equal(comparison.regressions[0].skill, 'action');
});

test('compares only metrics present and numeric in both reports', () => {
  const comparison = compareBenchmarkReports(
    { overallScore: 50, metrics: { story: 50, visual: null } },
    { overallScore: 60, metrics: { story: 60, audio: 90, visual: 100 } }
  );
  assert.equal(comparison.comparedMetricCount, 1);
  assert.equal(comparison.metricDeltas[0].skill, 'story');
});

test('requires explicit approval before creating a learning version', () => {
  const proposal = createLearningProposal({
    proposalId: 'proposal-001',
    changeSummary: 'Improve scene action selection',
    baselineReport: { overallScore: 70, metrics: { action: 70 } },
    candidateReport: { overallScore: 80, metrics: { action: 80 } },
    exampleIds: ['ru-fox-01', 'en-dragon-02']
  });
  assert.equal(proposal.status, 'pending-human-approval');
  assert.throws(() => createLearningVersion({ versionId: 'v2', proposal }), /explicitly approved/);
  const approved = resolveLearningProposal(proposal, { approved: true, reviewer: 'user' });
  assert.equal(approved.status, 'approved');
  const version = createLearningVersion({ versionId: 'v2', proposal: approved, parentVersionId: 'v1' });
  assert.equal(version.parentVersionId, 'v1');
  assert.equal(version.createdBy, 'user');
});

test('rejects approval when benchmark contains a regression', () => {
  const proposal = createLearningProposal({
    proposalId: 'proposal-002',
    changeSummary: 'Faster scene planning',
    baselineReport: { overallScore: 70, metrics: { action: 80, camera: 60 } },
    candidateReport: { overallScore: 75, metrics: { action: 55, camera: 90 } }
  });
  const resolved = resolveLearningProposal(proposal, { approved: true, reviewer: 'user' });
  assert.equal(resolved.status, 'blocked-by-evaluation');
  assert.throws(() => createLearningVersion({ versionId: 'v3', proposal: resolved }), /explicitly approved/);
});

test('rejects an unapproved proposal and supports rollback lookup', () => {
  const proposal = createLearningProposal({
    proposalId: 'proposal-003',
    changeSummary: 'Improve camera diversity',
    baselineReport: { overallScore: 60, metrics: { camera: 60 } },
    candidateReport: { overallScore: 60, metrics: { camera: 60 } }
  });
  assert.equal(resolveLearningProposal(proposal, { approved: false }).status, 'rejected');
  const history = [{ versionId: 'v1', changeSummary: 'Baseline' }, { versionId: 'v2', changeSummary: 'Approved change' }];
  assert.equal(findRollbackTarget(history, 'v1').changeSummary, 'Baseline');
  assert.equal(findRollbackTarget(history, 'missing'), null);
});

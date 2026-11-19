import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEditDecisionPlan } from '../src/edit-decision-engine.js';

test('keeps adjacent action phases continuous and classifies pacing', () => {
  const plan = buildEditDecisionPlan({ shots: [
    { id: 'a', sceneId: 's1', durationSeconds: 1, role: 'setup', continuity: { participantIds: ['Maya'], stateChanges: [] } },
    { id: 'b', sceneId: 's1', durationSeconds: 4, role: 'action', continuity: { participantIds: ['Maya', 'Noah'], stateChanges: [] } }
  ] }, [{ id: 's1' }]);
  assert.equal(plan.cuts[0].type, 'continuous_action');
  assert.equal(plan.pacing[0].pace, 'very_fast');
  assert.equal(plan.pacing[1].pace, 'steady');
  assert.deepEqual(plan.cuts[0].preserve.participants, ['Maya', 'Noah']);
});

test('uses only explicit transitions and identifies source-grounded location changes', () => {
  const plan = buildEditDecisionPlan({ shots: [
    { id: 'a', sceneId: 's1', durationSeconds: 3, continuity: { location: 'Kitchen', stateChanges: [] } },
    { id: 'b', sceneId: 's2', durationSeconds: 3, continuity: { location: 'Street', stateChanges: [] } }
  ] }, [{ id: 's1' }, { id: 's2', transition: 'dissolve' }]);
  assert.equal(plan.cuts[0].type, 'dissolve');
  assert.equal(plan.cuts[0].locationChanged, true);
  assert.match(plan.cuts[0].reason, /location change/);
});

test('reports conflicting object states instead of silently resolving them', () => {
  const plan = buildEditDecisionPlan({ shots: [
    { id: 'a', sceneId: 's1', durationSeconds: 2, continuity: { stateChanges: [{ entityId: 'door', property: 'state', value: 'closed' }] } },
    { id: 'b', sceneId: 's2', durationSeconds: 2, continuity: { stateChanges: [{ entityId: 'door', property: 'state', value: 'open' }] } }
  ] }, [{ id: 's1' }, { id: 's2' }]);
  assert.ok(plan.validation.issues.some(issue => issue.code === 'state-change-needs-grounded-transition'));
});

test('preserves explicit audio cues without inventing soundtrack events', () => {
  const plan = buildEditDecisionPlan({ shots: [] }, [
    { id: 's1', audioCues: [{ type: 'dialogue', startSeconds: 0, endSeconds: 2, description: 'Maya speaks' }] },
    { id: 's2' }
  ]);
  assert.equal(plan.soundtrack.length, 1);
  assert.equal(plan.soundtrack[0].type, 'dialogue');
});

test('reports missing camera coverage and invalid shot durations', () => {
  const plan = buildEditDecisionPlan({ shots: [
    { id: 'a', sceneId: 's1', durationSeconds: 0, continuity: {} },
    { id: 'b', sceneId: 's2', durationSeconds: 2, continuity: {} }
  ] }, []);
  assert.equal(plan.validation.passed, false);
  assert.ok(plan.validation.issues.some(issue => issue.code === 'non-positive-shot-duration'));
  assert.ok(plan.validation.issues.some(issue => issue.code === 'camera-coverage-unspecified'));
});

test('does not mistake planner fallback cut metadata for an authored transition', () => {
  const plan = buildEditDecisionPlan({ shots: [
    { id: 'a', sceneId: 's1', durationSeconds: 2, continuity: {} },
    { id: 'b', sceneId: 's1', durationSeconds: 2, cut: { type: 'cut', reason: 'planner default' }, continuity: {} }
  ] }, [{ id: 's1' }]);
  assert.equal(plan.cuts[0].type, 'continuous_action');
});

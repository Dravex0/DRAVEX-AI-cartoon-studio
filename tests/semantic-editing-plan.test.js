import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSemanticEditingPlan } from '../src/semantic-editing-plan.js';

test('turns an explicit action timeline into ordered, timed shots', () => {
  const plan = buildSemanticEditingPlan([{
    id: 'scene_1', durationSeconds: 4, characters: ['Maya', 'Noah'],
    camera: 'Wide shot, eye-level, tracking camera',
    actionTimeline: { phases: [
      { phase: 'preparation', start: 0, end: 0.2, actorId: 'Maya', description: 'Maya reaches for the phone', evidence: 'Maya reaches for the phone' },
      { phase: 'action', start: 0.2, end: 0.8, actorId: 'Maya', targetId: 'Noah', description: 'Maya gives Noah the phone', evidence: 'Maya gives Noah the phone' },
      { phase: 'reaction', start: 0.8, end: 1, actorId: 'Noah', description: 'Noah looks at the phone', evidence: 'Noah looks at the phone' }
    ] }
  }]);
  assert.equal(plan.shotCount, 3);
  assert.deepEqual(plan.shots.map(shot => shot.role), ['setup', 'action', 'reaction']);
  assert.deepEqual(plan.shots.map(shot => [shot.startSeconds, shot.endSeconds]), [[0, 0.8], [0.8, 3.2], [3.2, 4]]);
  assert.equal(plan.shots[0].camera.scale, 'wide');
  assert.equal(plan.shots[0].camera.movement, 'tracking');
  assert.equal(plan.shots[1].targetId, 'Noah');
});

test('preserves living and non-living entity relations and state in continuity metadata', () => {
  const world = {
    events: [{ sceneId: 's1', participants: ['Driver', 'Robot'] }],
    relations: [{ sceneId: 's1', type: 'changes_state_of', from: 'Driver', to: 'car door', property: 'openState' }]
  };
  const plan = buildSemanticEditingPlan([{
    id: 's1', durationSeconds: 3, location: 'Garage', characters: ['Driver', 'Robot'],
    visibleAction: 'Driver opens the car door',
    stateChanges: [{ entityId: 'car door', property: 'openState', previousValue: 'closed', value: 'open' }]
  }], world);
  assert.deepEqual(plan.shots[0].continuity.participantIds, ['Driver', 'Robot']);
  assert.equal(plan.shots[0].continuity.relations[0].to, 'car door');
  assert.equal(plan.shots[0].continuity.stateChanges[0].value, 'open');
});

test('does not fabricate a reaction or split a scene without explicit action phases', () => {
  const plan = buildSemanticEditingPlan([{
    id: 's1', durationSeconds: 5, visibleAction: 'The train arrives at the station'
  }]);
  assert.equal(plan.shotCount, 1);
  assert.equal(plan.shots[0].role, 'action');
  assert.equal(plan.shots[0].targetId, null);
});

test('falls back safely on invalid phase timing and reports the issue', () => {
  const plan = buildSemanticEditingPlan([{
    id: 's1', durationSeconds: 2, visibleAction: 'A door closes',
    actionTimeline: { phases: [{ phase: 'action', start: 0.8, end: 0.2 }] }
  }]);
  assert.equal(plan.shotCount, 1);
  assert.equal(plan.validation.passed, true);
  assert.ok(plan.validation.issues.some(issue => issue.code === 'invalid-action-timeline'));
});

test('keeps scene chronology and sums the actual timeline duration', () => {
  const plan = buildSemanticEditingPlan([
    { id: 's1', durationSeconds: 2, visibleAction: 'A person enters' },
    { id: 's2', durationSeconds: 3, location: 'Street', visibleAction: 'A car drives away' }
  ]);
  assert.equal(plan.totalDurationSeconds, 5);
  assert.deepEqual(plan.shots.map(shot => shot.sceneId), ['s1', 's2']);
  assert.equal(plan.shots[1].cut.reason, 'ordered scene boundary; preserve story chronology');
});

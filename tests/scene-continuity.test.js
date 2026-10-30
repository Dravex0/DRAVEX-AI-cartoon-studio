import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSceneContinuity } from '../src/scene-continuity.js';

test('accepts a clear state hand-off between adjacent scenes', () => {
  const report = evaluateSceneContinuity({
    scenes: [
      { id: 's1', startState: 'The red wooden door is closed.', endState: 'The red wooden door is open.', characters: ['Foxy'] },
      { id: 's2', startState: 'Foxy stands beside the open red wooden door.', endState: 'Foxy walks through the open red wooden door.', characters: ['Foxy'] }
    ],
    characterBible: [{ characterId: 'Foxy', visualDescription: 'Small orange fox', clothing: 'Blue scarf' }]
  });
  assert.equal(report.metrics.stateCoverage, 100);
  assert.ok(report.metrics.stateTransitionConsistency >= 20);
  assert.equal(report.metrics.characterReferenceCoverage, 100);
  assert.equal(report.issues.length, 0);
  assert.equal(report.passed, true);
});

test('flags a broken scene-to-scene state hand-off', () => {
  const report = evaluateSceneContinuity({
    scenes: [
      { id: 's1', startState: 'The red door is closed.', endState: 'The red door is open.' },
      { id: 's2', startState: 'A spaceship flies above the ocean.', endState: 'The spaceship lands.' }
    ]
  });
  assert.ok(report.issues.some(issue => issue.code === 'state-transition-mismatch'));
  assert.equal(report.metrics.characterReferenceCoverage, null);
  assert.equal(report.passed, false);
});

test('flags missing character profiles without pretending to inspect appearance', () => {
  const report = evaluateSceneContinuity({
    scenes: [{ id: 's1', startState: 'Foxy is outside.', endState: 'Foxy enters the forest.', characters: ['Foxy', 'Owl'] }],
    characterBible: [{ characterId: 'Foxy', visualDescription: 'Orange fox' }]
  });
  assert.equal(report.metrics.characterReferenceCoverage, 50);
  assert.ok(report.issues.some(issue => issue.code === 'character-reference-missing' && issue.characterId === 'Owl'));
});

test('marks continuity metrics unavailable when there is not enough source data', () => {
  const report = evaluateSceneContinuity({ scenes: [{ id: 's1', visibleAction: 'A character opens a wooden box.' }] });
  assert.equal(report.metrics.stateCoverage, 0);
  assert.equal(report.metrics.stateTransitionConsistency, null);
  assert.equal(report.metrics.characterReferenceCoverage, null);
  assert.equal(report.overallScore, 0);
});

test('handles empty and malformed scene collections safely', () => {
  const report = evaluateSceneContinuity({ scenes: null, characterBible: null });
  assert.equal(report.evaluatedSceneCount, 0);
  assert.equal(report.overallScore, null);
  assert.equal(report.passed, false);
});

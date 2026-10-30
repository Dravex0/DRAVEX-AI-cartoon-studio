import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStoryboardFromText } from '../src/storyboard-generator.js';
import { evaluateStoryboard } from '../src/ai-evaluation.js';
import { AI_CURRICULUM_V1 } from '../fixtures/ai-curriculum-v1.js';

test('curriculum cases are evaluated consistently across supported languages', () => {
  for (const sample of AI_CURRICULUM_V1) {
    const plan = buildStoryboardFromText(sample.story, sample.language, sample.character);
    const report = evaluateStoryboard({
      scenes: plan.scenes,
      expectedSceneCount: sample.expectedSceneCount,
      expectedStoryDetails: sample.expectedStoryDetails
    });
    assert.equal(report.metrics.storyStructure, 100, sample.id);
    assert.equal(report.metrics.sourceFidelity, 100, sample.id);
    assert.equal(report.metrics.actionSpecificity, 100, sample.id);
    assert.equal(report.metrics.actionDiversity, 100, sample.id);
    assert.equal(report.metrics.cameraVariety, 100, sample.id);
    assert.equal(report.passed, true, sample.id);
  }
});

test('reports missing or duplicated source details as measurable failures', () => {
  const report = evaluateStoryboard({
    scenes: [
      { id: 'scene_1', visibleAction: 'The hero opens the old door and steps inside.', camera: 'Wide shot', storyDetail: 'The hero finds a key.' },
      { id: 'scene_2', visibleAction: 'The hero turns and runs down the corridor.', camera: 'Close-up', storyDetail: 'The hero finds a key.' }
    ],
    expectedSceneCount: 2,
    expectedStoryDetails: ['The hero finds a key.']
  });
  assert.equal(report.metrics.sourceFidelity, 0);
  assert.equal(report.passed, false);
  assert.ok(report.issues.some(issue => issue.code === 'source-detail-lost-or-repeated'));
});

test('character and production skills remain unscored unless explicit requirements are supplied', () => {
  const report = evaluateStoryboard({
    scenes: [{ id: 'scene_1', visibleAction: 'A character carefully opens a mysterious wooden box.', camera: 'Medium shot' }]
  });
  assert.equal(report.metrics.characterConsistency, null);
  assert.equal(report.metrics.productionCompleteness, null);
});

test('checks explicit character membership and production readiness when requested', () => {
  const report = evaluateStoryboard({
    scenes: [{
      id: 'scene_1',
      characters: ['Foxy'],
      visibleAction: 'Foxy carefully opens a mysterious wooden box.',
      camera: 'Medium shot',
      imagePrompt: 'Orange fox in a forest',
      motionPrompt: 'Foxy opens the box',
      startState: 'Box closed',
      endState: 'Box open'
    }],
    characterRequirements: [{ sceneId: 'scene_1', characterId: 'Foxy' }],
    requireProductionFields: true
  });
  assert.equal(report.metrics.characterConsistency, 100);
  assert.equal(report.metrics.productionCompleteness, 100);
});

test('integrates optional scene continuity and character reference checks', () => {
  const report = evaluateStoryboard({
    scenes: [
      { id: 'scene_1', characters: ['Foxy'], visibleAction: 'Foxy opens the red wooden door and steps inside.', camera: 'Wide shot', startState: 'The red wooden door is closed.', endState: 'The red wooden door is open.' },
      { id: 'scene_2', characters: ['Foxy'], visibleAction: 'Foxy walks through the open red wooden door into the forest.', camera: 'Close-up', startState: 'The open red wooden door stands behind Foxy.', endState: 'Foxy reaches the forest path.' }
    ],
    characterBible: [{ characterId: 'Foxy', visualDescription: 'Small orange fox', clothing: 'Blue scarf' }],
    requireContinuity: true
  });
  assert.equal(report.metrics.stateCoverage, 100);
  assert.equal(report.metrics.characterReferenceCoverage, 100);
  assert.ok(report.continuityReport);
});

test('detects when the storyboard reverses the original story event order', () => {
  const report = evaluateStoryboard({
    scenes: [
      { id: 'scene_1', visibleAction: 'The hero opens the old door and steps inside.', camera: 'Wide shot', storyDetail: 'The hero finds a key.' },
      { id: 'scene_2', visibleAction: 'The hero turns and runs down the corridor.', camera: 'Close-up', storyDetail: 'The hero escapes the castle.' },
      { id: 'scene_3', visibleAction: 'The hero returns and unlocks the gate.', camera: 'Tracking shot', storyDetail: 'The hero enters the castle.' }
    ],
    expectedSceneCount: 3,
    expectedStoryDetails: ['The hero enters the castle.', 'The hero finds a key.', 'The hero escapes the castle.']
  });
  assert.equal(report.metrics.sourceFidelity, 100);
  assert.equal(report.metrics.sourceOrderConsistency, 0);
  assert.ok(report.issues.some(issue => issue.code === 'source-event-order-changed'));
  assert.equal(report.passed, false);
});

test('does not score event chronology when source details are missing or duplicated', () => {
  const report = evaluateStoryboard({
    scenes: [
      { id: 'scene_1', visibleAction: 'The hero opens the old door and steps inside.', camera: 'Wide shot', storyDetail: 'The hero finds a key.' },
      { id: 'scene_2', visibleAction: 'The hero turns and runs down the corridor.', camera: 'Close-up', storyDetail: 'The hero finds a key.' }
    ],
    expectedSceneCount: 2,
    expectedStoryDetails: ['The hero enters the castle.', 'The hero finds a key.']
  });
  assert.equal(report.metrics.sourceOrderConsistency, null);
});

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

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
    assert.equal(report.metrics.sourceOrderConsistency, 100, sample.id);
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
  assert.equal(report.metrics.sourceOrderConsistency, 50);
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

test('accepts a directed interaction when both participants belong to the scene cast', () => {
  const result = evaluateStoryboard({
    scenes: [{
      id: 'scene_1', title: 'Help', visibleAction: 'Bird helps Foxy cross the river safely.',
      camera: 'Wide tracking shot.', characters: ['Bird', 'Foxy'],
      interaction: { type: 'help', actorId: 'Bird', targetId: 'Foxy', evidence: 'Bird helps Foxy' }
    }],
    expectedSceneCount: 1
  });
  assert.equal(result.metrics.interactionIntegrity, 100);
  assert.equal(result.issues.some(issue => issue.code === 'invalid-character-interaction'), false);
});

test('flags an interaction that names a participant outside the scene cast', () => {
  const result = evaluateStoryboard({
    scenes: [{
      id: 'scene_1', title: 'Help', visibleAction: 'Bird helps Foxy cross the river safely.',
      camera: 'Wide tracking shot.', characters: ['Bird', 'Foxy'],
      interaction: { type: 'help', actorId: 'Wolf', targetId: 'Foxy', evidence: 'Wolf helps Foxy' }
    }],
    expectedSceneCount: 1
  });
  assert.equal(result.metrics.interactionIntegrity, 0);
  assert.ok(result.issues.some(issue => issue.code === 'invalid-character-interaction'));
});


test('accepts causal links only when they cite adjacent source-scene evidence', () => {
  const result = evaluateStoryboard({
    scenes: [
      { id: 'scene_1', storyDetail: 'The bridge collapses.', visibleAction: 'The bridge breaks apart and falls into the river.', camera: 'Wide shot.' },
      { id: 'scene_2', storyDetail: 'As a result, the travelers take the forest path.', visibleAction: 'The travelers turn away from the river and enter the forest path.', camera: 'Tracking shot.', causalLink: {
        type: 'consequence', causeSceneId: 'scene_1', effectSceneId: 'scene_2',
        marker: 'As a result', causeEvidence: 'The bridge collapses.',
        evidence: 'As a result, the travelers take the forest path.'
      } }
    ],
    expectedSceneCount: 2
  });
  assert.equal(result.metrics.causalIntegrity, 100);
  assert.equal(result.issues.some(issue => issue.code === 'invalid-causal-link'), false);
});

test('rejects causal links that cite unsupported source evidence', () => {
  const result = evaluateStoryboard({
    scenes: [
      { id: 'scene_1', storyDetail: 'The bridge collapses.', visibleAction: 'The bridge breaks apart and falls into the river.', camera: 'Wide shot.' },
      { id: 'scene_2', storyDetail: 'The travelers look for another route.', visibleAction: 'The travelers inspect a map beside the river.', camera: 'Medium shot.' },
      { id: 'scene_3', storyDetail: 'Therefore, they enter the forest.', visibleAction: 'The travelers enter the forest path together.', camera: 'Tracking shot.', causalLink: {
        type: 'consequence', causeSceneId: 'scene_1', effectSceneId: 'scene_3',
        marker: 'Therefore', causeEvidence: 'An earthquake destroyed the bridge.',
        evidence: 'Therefore, they enter the forest.'
      } }
    ],
    expectedSceneCount: 3
  });
  assert.equal(result.metrics.causalIntegrity, 0);
  assert.ok(result.issues.some(issue => issue.code === 'invalid-causal-link'));
});

test('accepts source-grounded character and prop state changes with consistent hand-off', () => {
  const report = evaluateStoryboard({
    scenes: [
      { id: 's1', storyDetail: 'Foxy picks up the silver key.', characters: ['Foxy'], visibleAction: 'Foxy bends down and lifts the silver key from the moss.', camera: 'Low close-up.', stateChanges: [
        { entityType: 'prop', entityId: 'silver key', property: 'holder', previousValue: null, value: 'Foxy', actorId: 'Foxy', evidence: 'Foxy picks up the silver key.' }
      ] },
      { id: 's2', storyDetail: 'Foxy drops the silver key.', characters: ['Foxy'], visibleAction: 'Foxy releases the silver key onto the stone path.', camera: 'Side medium shot.', stateChanges: [
        { entityType: 'prop', entityId: 'silver key', property: 'holder', previousValue: 'Foxy', value: null, actorId: 'Foxy', evidence: 'Foxy drops the silver key.' }
      ] }
    ],
    expectedSceneCount: 2
  });
  assert.equal(report.metrics.stateChangeIntegrity, 100);
  assert.equal(report.issues.some(issue => issue.code === 'invalid-scene-state-change'), false);
});

test('rejects state changes with invented source evidence or broken previous-state hand-off', () => {
  const report = evaluateStoryboard({
    scenes: [
      { id: 's1', storyDetail: 'Foxy picks up the silver key.', characters: ['Foxy'], visibleAction: 'Foxy lifts the silver key from the ground.', camera: 'Low close-up.', stateChanges: [
        { entityType: 'prop', entityId: 'silver key', property: 'holder', previousValue: null, value: 'Foxy', actorId: 'Foxy', evidence: 'Foxy picks up the silver key.' }
      ] },
      { id: 's2', storyDetail: 'Foxy drops the silver key.', characters: ['Foxy'], visibleAction: 'Foxy drops the silver key onto the path.', camera: 'Side shot.', stateChanges: [
        { entityType: 'prop', entityId: 'silver key', property: 'holder', previousValue: null, value: null, actorId: 'Foxy', evidence: 'Foxy drops an ancient crown.' }
      ] }
    ],
    expectedSceneCount: 2
  });
  assert.equal(report.metrics.stateChangeIntegrity, 0);
  assert.ok(report.issues.some(issue => issue.code === 'invalid-scene-state-change'));
});

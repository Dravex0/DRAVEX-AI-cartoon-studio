import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCharacterActionTimelines,
  validateCharacterActionTimeline
} from '../src/character-action-timeline.js';
import { evaluateStoryboard } from '../src/ai-evaluation.js';
import { normalizeScene } from '../src/scene-model.js';

const scene = {
  id: 'scene_1',
  characters: ['Foxy'],
  storyDetail: 'Foxy notices the silver key and picks it up.',
  visibleAction: 'Foxy notices the silver key, reaches down, and picks it up.',
  motionPrompt: 'Foxy reaches down and lifts the silver key.',
  actionTimeline: {
    schemaVersion: 1,
    phases: [
      { phase: 'preparation', start: 0, end: 0.2, actorId: 'Foxy', description: 'Foxy notices the key and leans forward.', evidence: 'Foxy notices the silver key' },
      { phase: 'action', start: 0.2, end: 0.65, actorId: 'Foxy', targetId: 'Foxy', description: 'Foxy reaches down and lifts the key.', evidence: 'picks it up' },
      { phase: 'reaction', start: 0.65, end: 0.82, actorId: 'Foxy', description: 'Foxy looks at the key with surprise.', evidence: 'Foxy notices the silver key' },
      { phase: 'result', start: 0.82, end: 1, actorId: 'Foxy', description: 'Foxy holds the key securely.', evidence: 'picks it up' }
    ]
  }
};

test('scene normalization preserves action timeline metadata for evaluation', () => {
  assert.deepEqual(normalizeScene(scene).actionTimeline, scene.actionTimeline);
});

test('accepts ordered, source-grounded action phases in normalized scene time', () => {
  const report = validateCharacterActionTimeline(scene);
  assert.equal(report.status, 'valid');
  assert.equal(report.passed, true);
  assert.equal(report.phaseCount, 4);
});

test('treats a missing timeline as unavailable rather than a failure', () => {
  const report = validateCharacterActionTimeline({ id: 'legacy-scene' });
  assert.equal(report.status, 'not-provided');
  assert.equal(report.passed, null);
});

test('rejects reaction that starts before the action finishes', () => {
  const candidate = structuredClone(scene);
  candidate.actionTimeline.phases[2].start = 0.6;
  const report = validateCharacterActionTimeline(candidate);
  assert.ok(report.issues.some(item => item.code === 'reaction-before-action-complete'));
});

test('rejects phases with invalid time bounds and unknown actors', () => {
  const candidate = structuredClone(scene);
  candidate.actionTimeline.phases[1].end = 1.2;
  candidate.actionTimeline.phases[1].actorId = 'Wolf';
  const report = validateCharacterActionTimeline(candidate);
  assert.ok(report.issues.some(item => item.code === 'phase-timing-invalid'));
  assert.ok(report.issues.some(item => item.code === 'phase-actor-not-in-cast'));
});

test('requires an action phase and evidence grounded in scene text', () => {
  const candidate = structuredClone(scene);
  candidate.actionTimeline.phases = [
    { phase: 'preparation', start: 0, end: 0.5, actorId: 'Foxy', description: 'Foxy prepares.', evidence: 'invented evidence' }
  ];
  const report = validateCharacterActionTimeline(candidate);
  assert.ok(report.issues.some(item => item.code === 'action-phase-required'));
  assert.ok(report.issues.some(item => item.code === 'phase-evidence-ungrounded'));
});

test('aggregates supplied timelines without penalizing scenes that omit them', () => {
  const report = evaluateCharacterActionTimelines([scene, { id: 'scene_2' }]);
  assert.equal(report.suppliedSceneCount, 1);
  assert.equal(report.coverage, 50);
  assert.equal(report.integrity, 100);
  assert.equal(report.passed, true);
});

test('marks an entirely legacy storyboard as not yet measurable', () => {
  const report = evaluateCharacterActionTimelines([{ id: 'scene_1' }]);
  assert.equal(report.coverage, null);
  assert.equal(report.integrity, null);
  assert.equal(report.passed, null);
});


test('storyboard quality gate includes supplied action timeline integrity', () => {
  const valid = structuredClone(scene);
  const invalid = structuredClone(scene);
  invalid.id = 'scene_2';
  invalid.actionTimeline.phases[2].start = 0.6;
  const report = evaluateStoryboard({
    scenes: [
      { ...valid, id: 'scene_1' },
      invalid,
      { id: 'scene_3', visibleAction: 'Foxy walks along the moonlit forest path.', characters: ['Foxy'] }
    ],
    expectedSceneCount: 3
  });
  assert.equal(report.actionTimelineReport.suppliedSceneCount, 2);
  assert.equal(report.actionTimelineReport.integrity, 50);
  assert.equal(report.metrics.actionTimelineIntegrity, 50);
  assert.ok(report.issues.some(item => item.code === 'invalid-character-action-timeline'));
  assert.equal(report.passed, false);
});

test('legacy storyboard without action timelines remains evaluable', () => {
  const report = evaluateStoryboard({
    scenes: [
      { id: 'a', visibleAction: 'Foxy walks across the moonlit forest path.' },
      { id: 'b', visibleAction: 'Foxy discovers a silver key beneath a tree.' },
      { id: 'c', visibleAction: 'Foxy raises the silver key toward the moon.' }
    ],
    expectedSceneCount: 3
  });
  assert.equal(report.actionTimelineReport.passed, null);
  assert.equal(report.metrics.actionTimelineCoverage, null);
});

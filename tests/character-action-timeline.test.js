import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCharacterActionTimelines,
  validateCharacterActionTimeline,
  normalizeCharacterActionTimeline
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
      { phase: 'action', start: 0.2, end: 0.65, actorId: 'Foxy', targetId: 'silver key', description: 'Foxy reaches down and lifts the key.', evidence: 'Foxy notices the silver key, reaches down, and picks it up.' },
      { phase: 'reaction', start: 0.65, end: 0.82, actorId: 'Foxy', description: 'Foxy looks at the key with surprise.', evidence: 'Foxy notices the silver key' },
      { phase: 'result', start: 0.82, end: 1, actorId: 'Foxy', description: 'Foxy holds the key securely.', evidence: 'Foxy picks up the silver key.' }
    ]
  }
};

test('scene normalization preserves action timeline metadata for evaluation', () => {
  assert.deepEqual(normalizeScene(scene).actionTimeline, normalizeCharacterActionTimeline(scene.actionTimeline));
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


test('does not silently discard a malformed but supplied timeline during scene normalization', () => {
  const malformed = normalizeScene({ id: 'bad', actionTimeline: { schemaVersion: 1, phases: 'not-an-array' } });
  assert.notEqual(malformed.actionTimeline, null);
  const report = evaluateCharacterActionTimelines([malformed]);
  assert.equal(report.passed, false);
  assert.ok(report.issues.some(item => item.code === 'timeline-shape-invalid'));
});

test('rejects an action actor when the scene explicitly has an empty cast', () => {
  const candidate = structuredClone(scene);
  candidate.characters = [];
  const report = validateCharacterActionTimeline(candidate);
  assert.ok(report.issues.some(item => item.code === 'phase-actor-not-in-cast'));
});

test('keeps legacy timelines evaluable when the scene cast is not provided', () => {
  const candidate = structuredClone(scene);
  delete candidate.characters;
  const report = validateCharacterActionTimeline(candidate);
  assert.equal(report.passed, true);
});

test('normalization preserves the distinction between an omitted and explicit empty cast', () => {
  const legacy = normalizeScene({ ...scene });
  delete legacy.characters;
  const normalizedLegacy = normalizeScene({ ...scene, characters: undefined });
  assert.equal(normalizedLegacy.characterCastProvided, false);
  assert.equal(validateCharacterActionTimeline(normalizedLegacy).passed, true);

  const explicitEmpty = normalizeScene({ ...scene, characters: [] });
  assert.equal(explicitEmpty.characterCastProvided, true);
  assert.ok(validateCharacterActionTimeline(explicitEmpty).issues.some(
    item => item.code === 'phase-actor-not-in-cast'
  ));
});

test('normalizes explicit per-character motion keyframes for runtime playback', () => {
  const candidate = structuredClone(scene);
  candidate.actionTimeline.phases[1].motion = {
    from: { x: 0.2, y: 0.8 },
    to: { x: 0.7, y: 0.4, scale: 1.5, ignored: 10 }
  };
  const normalized = normalizeScene(candidate).actionTimeline.phases[1].motion;
  assert.deepEqual(normalized, {
    from: { x: 0.2, y: 0.8 },
    to: { x: 0.7, y: 0.4, scale: 1.5 }
  });
});

test('rejects a supplied motion block without a valid numeric target pose', () => {
  const candidate = structuredClone(scene);
  candidate.actionTimeline.phases[1].motion = { to: { x: null, y: '0.5' } };
  const report = validateCharacterActionTimeline(candidate);
  assert.ok(report.issues.some(item => item.code === 'phase-motion-invalid'));
});

test('normalizes and validates supported motion easing profiles', () => {
  const candidate = structuredClone(scene);
  candidate.actionTimeline.phases[1].easing = 'ease-in-out';
  const normalized = normalizeScene(candidate).actionTimeline.phases[1];
  assert.equal(normalized.easing, 'ease-in-out');
  assert.equal(validateCharacterActionTimeline(candidate).passed, true);
});

test('rejects unsupported motion easing profiles', () => {
  const candidate = structuredClone(scene);
  candidate.actionTimeline.phases[1].easing = 'spring-rocket';
  const report = validateCharacterActionTimeline(candidate);
  assert.ok(report.issues.some(item => item.code === 'phase-easing-invalid'));
});


test('normalizes and validates ordered, source-grounded action substeps', () => {
  const candidate = {
    ...structuredClone(scene),
    storyDetail: 'Foxy enters the room, hears a sound, then walks quietly.',
    characters: ['Foxy'],
    actionTimeline: {
      schemaVersion: 1,
      phases: [{
        phase: 'action', start: 0, end: 1, actorId: 'Foxy',
        description: 'Foxy enters, hears a sound, and walks quietly.',
        evidence: 'Foxy enters the room',
        steps: [
          { intent: 'enter_location', motionCue: 'walk', start: 0, end: 0.33, actorId: 'Foxy', description: 'Enter the room', evidence: 'enters the room' },
          { intent: 'hear_sound', motionCue: 'turn', start: 0.33, end: 0.66, actorId: 'Foxy', description: 'Hear a sound', evidence: 'hears a sound' },
          { intent: 'stealth_advance', motionCue: 'walk', start: 0.66, end: 1, actorId: 'Foxy', description: 'Walk quietly', evidence: 'walks quietly' }
        ]
      }]
    }
  };
  assert.equal(validateCharacterActionTimeline(candidate).passed, true);
  assert.deepEqual(
    normalizeCharacterActionTimeline(candidate.actionTimeline).phases[0].steps.map(step => step.intent),
    ['enter_location', 'hear_sound', 'stealth_advance']
  );
});

test('rejects unordered or ungrounded action substeps', () => {
  const candidate = {
    ...structuredClone(scene),
    actionTimeline: {
      schemaVersion: 1,
      phases: [{
        phase: 'action', start: 0, end: 1, actorId: 'Foxy',
        description: 'Foxy picks up a key.', evidence: 'picks it up',
        steps: [
          { intent: 'pick_up', motionCue: 'turn', start: 0.5, end: 0.8, actorId: 'Foxy', description: 'Pick up key', evidence: 'picks it up' },
          { intent: 'open', motionCue: 'turn', start: 0.2, end: 0.4, actorId: 'Foxy', description: 'Open door', evidence: 'opens an invented door' }
        ]
      }]
    }
  };
  const report = validateCharacterActionTimeline(candidate);
  assert.ok(report.issues.some(item => item.code === 'action-step-timing-invalid'));
  assert.ok(report.issues.some(item => item.code === 'action-step-evidence-ungrounded'));
});

test('allows synchronized overlapping steps for different characters', () => {
  const candidate = {
    id: 'paired-action',
    characters: ['Mira', 'Noah'],
    storyDetail: 'Mira and Noah combine their powers.',
    actionTimeline: {
      schemaVersion: 1,
      phases: [{
        phase: 'action', start: 0, end: 1, actorId: 'Mira',
        description: 'Mira and Noah combine their powers.',
        evidence: 'Mira and Noah combine their powers.',
        steps: [
          { intent: 'team_magic', motionCue: 'magic', start: 0.2, end: 0.8,
            actorId: 'Mira', targetId: 'Noah', description: 'Mira channels energy.',
            evidence: 'Mira and Noah combine their powers.' },
          { intent: 'team_magic', motionCue: 'magic', start: 0.2, end: 0.8,
            actorId: 'Noah', targetId: 'Mira', description: 'Noah channels energy.',
            evidence: 'Mira and Noah combine their powers.' }
        ]
      }]
    }
  };
  assert.equal(validateCharacterActionTimeline(candidate).passed, true);
});

test('rejects overlapping steps assigned to the same character', () => {
  const candidate = {
    id: 'same-actor-overlap',
    characters: ['Mira', 'Noah'],
    storyDetail: 'Mira combines her powers.',
    actionTimeline: {
      schemaVersion: 1,
      phases: [{
        phase: 'action', start: 0, end: 1, actorId: 'Mira',
        description: 'Mira combines her powers.',
        evidence: 'Mira combines her powers.',
        steps: [
          { intent: 'power_up', motionCue: 'magic', start: 0.1, end: 0.7,
            actorId: 'Mira', description: 'Mira channels energy.',
            evidence: 'Mira combines her powers.' },
          { intent: 'power_up', motionCue: 'magic', start: 0.5, end: 0.9,
            actorId: 'Mira', description: 'Mira sustains energy.',
            evidence: 'Mira combines her powers.' }
        ]
      }]
    }
  };
  const report = validateCharacterActionTimeline(candidate);
  assert.ok(report.issues.some(item => item.code === 'action-step-timing-invalid'));
});

test('rejects action targets that are not named in their locked source evidence', () => {
  const candidate = structuredClone(scene);
  candidate.actionTimeline.phases[1].targetId = 'secret portal';
  const report = validateCharacterActionTimeline(candidate);
  assert.ok(report.issues.some(item => item.code === 'phase-target-evidence-mismatch'));
});

test('rejects action substeps that assign a real sentence to an unmentioned target', () => {
  const candidate = {
    characters: ['Mira', 'Noah'],
    storyDetail: 'Mira throws the ball to Noah.',
    actionTimeline: {
      schemaVersion: 1,
      phases: [{
        phase: 'action', start: 0, end: 1, actorId: 'Mira',
        description: 'Mira throws the ball to Noah.',
        evidence: 'Mira throws the ball to Noah.',
        steps: [{
          intent: 'throw', motionCue: 'throw', start: 0.2, end: 0.8,
          actorId: 'Noah', targetId: 'wall',
          description: 'Noah throws the ball at a wall.',
          evidence: 'Mira throws the ball to Noah.'
        }]
      }]
    }
  };
  const report = validateCharacterActionTimeline(candidate);
  assert.ok(report.issues.some(item => item.code === 'action-step-target-evidence-mismatch'));
});

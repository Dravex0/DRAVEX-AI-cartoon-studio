import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneInteractionModel, formatSceneInteractionInstructions } from '../src/scene-interaction-model.js';
import { buildMotionGenerationPrompt } from '../src/scene-production.js';

test('builds grounded interaction links between actor, object and receiver', () => {
  const scene = {
    storyDetail: 'Mira throws the ball to Noah. Noah catches the ball.',
    characters: ['Mira', 'Noah'],
    physicsEvents: [
      { id: 'throw', type: 'throw', entityId: 'ball', actorId: 'Mira', targetId: 'Noah', contact: true,
        start: 0.1, end: 0.45, evidence: 'Mira throws the ball to Noah.' },
      { id: 'catch', type: 'catch', entityId: 'ball', actorId: 'Noah', targetId: 'ball', contact: true,
        start: 0.45, end: 0.7, evidence: 'Noah catches the ball.' }
    ]
  };
  const model = buildSceneInteractionModel(scene);
  assert.equal(model.status, 'grounded-interactions');
  assert.equal(model.eventCount, 2);
  assert.deepEqual(model.events.map(event => event.type), ['throw', 'catch']);
  assert.deepEqual(model.events.map(event => [event.start, event.end]), [[0.1, 0.45], [0.45, 0.7]]);
  assert.ok(model.entities.some(entity => entity.id === 'Mira' && entity.roles.includes('actor')));
  assert.ok(model.entities.some(entity => entity.id === 'Noah'));
  const prompt = formatSceneInteractionInstructions(model);
  assert.match(prompt, /one physical object has one location and at most one holder/i);
  assert.match(prompt, /handoff must not duplicate the object/i);
});

test('does not create interaction edges from ungrounded or missing evidence', () => {
  const model = buildSceneInteractionModel({
    storyDetail: 'Mira looks at the ball.',
    physicsEvents: [{
      id: 'invented-grasp', type: 'grasp', entityId: 'ball', actorId: 'Mira',
      evidence: 'Mira grasps the ball.'
    }]
  });
  assert.equal(model.eventCount, 0);
  assert.equal(model.status, 'no-grounded-interactions');
  assert.equal(formatSceneInteractionInstructions(model), '');
});

test('preserves unknown contact state instead of assuming a collision or grip', () => {
  const model = buildSceneInteractionModel({
    storyDetail: 'Mira pushes the cart.',
    physicsEvents: [{
      id: 'push', type: 'push', entityId: 'cart', actorId: 'Mira',
      evidence: 'Mira pushes the cart.'
    }]
  });
  assert.equal(model.events[0].contact, null);
  assert.match(formatSceneInteractionInstructions(model), /Contact state is unknown/);
});

test('models a single-holder handoff and prevents simultaneous ownership', () => {
  const model = buildSceneInteractionModel({
    storyDetail: 'Mira grasps the key. Mira gives the key to Noah.',
    physicsEvents: [
      { id: 'grasp', type: 'grasp', entityId: 'key', actorId: 'Mira', evidence: 'Mira grasps the key.' },
      { id: 'transfer', type: 'transfer', entityId: 'key', fromEntityId: 'Mira', toEntityId: 'Noah',
        evidence: 'Mira gives the key to Noah.' }
    ]
  });
  assert.deepEqual(model.holderTimeline.map(item => item.holderAfter), ['Mira', 'Noah']);
  assert.match(formatSceneInteractionInstructions(model), /at most one holder at a time/);
});

test('adds only evidence-backed prop state changes to the interaction graph', () => {
  const model = buildSceneInteractionModel({
    storyDetail: 'Foxy picks up the silver key and opens the ancient door.',
    stateChanges: [
      { entityType: 'prop', entityId: 'silver key', property: 'holder', previousValue: null,
        value: 'Foxy', actionIntent: 'pick_up', position: { x: 0.72, y: 0.55 },
        evidence: 'Foxy picks up the silver key' },
      { entityType: 'prop', entityId: 'ancient door', property: 'open', previousValue: false,
        value: true, actionIntent: 'open', evidence: 'opens the ancient door' },
      { entityType: 'prop', entityId: 'secret portal', property: 'visible', previousValue: false,
        value: true, evidence: 'a secret portal appears' }
    ]
  });
  assert.equal(model.stateTransitionCount, 2);
  assert.deepEqual(model.stateTransitions.map(item => item.entityId), ['silver key', 'ancient door']);
  assert.match(formatSceneInteractionInstructions(model), /silver key.holder/);
  assert.match(formatSceneInteractionInstructions(model), /ancient door.open/);
  assert.doesNotMatch(formatSceneInteractionInstructions(model), /secret portal/);
});

test('injects grounded interaction rules into the final motion-generation prompt', () => {
  const prompt = buildMotionGenerationPrompt({
    visibleAction: 'Mira gives the key to Noah.',
    storyDetail: 'Mira gives the key to Noah.',
    physicsEvents: [{
      id: 'handoff', type: 'transfer', entityId: 'key', fromEntityId: 'Mira',
      toEntityId: 'Noah', evidence: 'Mira gives the key to Noah.'
    }]
  });
  assert.match(prompt, /Grounded entity-interaction graph/);
  assert.match(prompt, /continuous handoff/i);
  assert.match(prompt, /never duplicate the object/i);
});

test('keeps raw physics event evidence aligned when malformed entries are skipped', () => {
  const scene = {
    id: 'indexed-events',
    storyDetail: 'Mira throws the ball to Noah.',
    physicsEvents: [
      null,
      { type: 'throw', entityId: 'ball', actorId: 'Mira', targetId: 'Noah',
        evidence: 'Mira throws the ball to Noah.' }
    ]
  };
  const model = buildSceneInteractionModel(scene);
  assert.equal(model.eventCount, 1);
  assert.equal(model.events[0].type, 'throw');
  assert.equal(model.events[0].actorId, 'Mira');
  assert.equal(model.events[0].targetId, 'Noah');
});

test('creates directed character-to-character interaction edges from validated action substeps', () => {
  const scene = {
    characters: ['Mira', 'Noah'],
    storyDetail: 'Mira hugs Noah, then Noah waves to Mira.',
    actionTimeline: {
      schemaVersion: 1,
      phases: [
        { phase: 'preparation', start: 0, end: 0.1, actorId: 'Mira',
          description: 'Mira approaches Noah.', evidence: 'Mira hugs Noah,' },
        { phase: 'action', start: 0.1, end: 0.75, actorId: 'Mira',
          description: 'They interact.', evidence: 'Mira hugs Noah, then Noah waves to Mira.',
          steps: [
            { intent: 'hug', motionCue: 'contact', start: 0.1, end: 0.4,
              actorId: 'Mira', targetId: 'Noah', description: 'Mira hugs Noah.',
              evidence: 'Mira hugs Noah,' },
            { intent: 'wave', motionCue: 'gesture', start: 0.45, end: 0.7,
              actorId: 'Noah', targetId: 'Mira', description: 'Noah waves to Mira.',
              evidence: 'Noah waves to Mira.' }
          ] }
      ]
    }
  };
  const model = buildSceneInteractionModel(scene);
  assert.equal(model.eventCount, 2);
  assert.deepEqual(model.events.map(event => [event.actorId, event.targetId, event.intent]), [
    ['Mira', 'Noah', 'hug'], ['Noah', 'Mira', 'wave']
  ]);
  assert.equal(model.events[0].contact, null);
  assert.match(formatSceneInteractionInstructions(model), /Mira.*Noah/);
  assert.match(formatSceneInteractionInstructions(model), /Noah.*Mira/);
});

test('ignores invalid or ungrounded action timelines when building interaction edges', () => {
  const model = buildSceneInteractionModel({
    characters: ['Mira', 'Noah'],
    storyDetail: 'Mira looks at Noah.',
    actionTimeline: {
      schemaVersion: 1,
      phases: [{
        phase: 'action', start: 0.1, end: 0.8, actorId: 'Mira',
        description: 'Mira secretly pushes Noah.', evidence: 'Mira secretly pushes Noah.',
        steps: [{ intent: 'push', motionCue: 'push', start: 0.2, end: 0.6,
          actorId: 'Mira', targetId: 'Noah', description: 'Mira pushes Noah.',
          evidence: 'Mira secretly pushes Noah.' }]
      }]
    }
  });
  assert.equal(model.eventCount, 0);
});

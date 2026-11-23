import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneWorldModel } from '../src/scene-world-model.js';

test('builds the same directed interaction model for people, animals and robots', () => {
  const model = buildSceneWorldModel([
    { id: 's1', characters: ['Maya', 'Noah'], storyDetail: 'Maya picks up the phone and gives Noah the phone.',
      interaction: { type: 'give', actorId: 'Maya', targetId: 'Noah', evidence: 'Maya picks up the phone and gives Noah the phone.' },
      stateChanges: [{ entityType: 'prop', entityId: 'phone', property: 'holder', previousValue: null,
        value: 'Maya', actorId: 'Maya', evidence: 'Maya picks up the phone', actionIntent: 'pick_up' }] },
    { id: 's2', characters: ['Noah', 'Rex the dog'], storyDetail: 'Noah gives Rex the ball.',
      interaction: { type: 'give', actorId: 'Noah', targetId: 'Rex the dog', evidence: 'Noah gives Rex the ball' } },
    { id: 's3', characters: ['Unit 7', 'Maya'], storyDetail: 'Unit 7 helps Maya.',
      interaction: { type: 'help', actorId: 'Unit 7', targetId: 'Maya', evidence: 'Unit 7 helps Maya' } }
  ]);

  assert.equal(model.entityCount >= 5, true);
  assert.ok(model.entities.some(entity => entity.id === 'Maya' && entity.kind === 'character'));
  assert.ok(model.entities.some(entity => entity.id === 'Rex the dog' && entity.kind === 'character'));
  assert.ok(model.entities.some(entity => entity.id === 'Unit 7' && entity.kind === 'character'));
  assert.deepEqual(model.relations.filter(item => item.type === 'acts_on').map(item => [item.from, item.to]), [
    ['Maya', 'Noah'], ['Noah', 'Rex the dog'], ['Unit 7', 'Maya']
  ]);
  assert.ok(model.entities.some(entity => entity.id === 'phone' && entity.kind === 'prop'));
});

test('represents object, vehicle and location state without species-specific assumptions', () => {
  const model = buildSceneWorldModel([
    { id: 's1', characters: ['Driver'], location: 'Garage', storyDetail: 'Driver opens the car door. Driver drives the car onto the street.',
      stateChanges: [
        { entityType: 'prop', entityId: 'car door', property: 'openState', previousValue: 'closed', value: 'open', actorId: 'Driver', evidence: 'Driver opens the car door', actionIntent: 'open' },
        { entityType: 'vehicle', entityId: 'car', property: 'location', previousValue: 'Garage', value: 'Street', actorId: 'Driver', evidence: 'Driver drives the car onto the street' }
      ] }
  ]);
  assert.ok(model.entities.some(entity => entity.id === 'Garage' && entity.kind === 'location'));
  assert.ok(model.entities.some(entity => entity.id === 'car' && entity.kind === 'vehicle'));
  assert.ok(model.relations.some(item => item.to === 'car door' && item.property === 'openState'));
});

test('reports conflicting object-state handoffs instead of silently accepting them', () => {
  const model = buildSceneWorldModel([
    { id: 's1', characters: ['Maya'], storyDetail: 'Maya picks up the key.', stateChanges: [
      { entityType: 'prop', entityId: 'key', property: 'holder', previousValue: null, value: 'Maya', actorId: 'Maya', evidence: 'Maya picks up the key.' }
    ] },
    { id: 's2', characters: ['Noah'], storyDetail: 'Noah drops the key.', stateChanges: [
      { entityType: 'prop', entityId: 'key', property: 'holder', previousValue: 'Noah', value: null, actorId: 'Noah', evidence: 'Noah drops the key.' }
    ] }
  ]);
  assert.equal(model.validation.stateContinuityConflicts.length, 1);
  assert.equal(model.validation.stateContinuityConflicts[0].entityId, 'key');
});

test('handles an empty or malformed scene list safely', () => {
  assert.equal(buildSceneWorldModel(null).entityCount, 0);
  assert.equal(buildSceneWorldModel([null, {}, 'invalid']).events.length, 3);
});

test('grounds explicit natural-language actions for all supported story languages', () => {
  const samples = [
    { language: 'en', detail: 'Maya helps Noah.', expected: 'help' },
    { language: 'ru', detail: 'Maya помогает Noah.', expected: 'help' },
    { language: 'uk', detail: 'Maya допомагає Noah.', expected: 'help' },
    { language: 'es', detail: 'Maya ayuda a Noah.', expected: 'help' }
  ];
  for (const sample of samples) {
    const model = buildSceneWorldModel([{
      id: sample.language, language: sample.language,
      characters: ['Maya', 'Noah'], storyDetail: sample.detail
    }]);
    assert.ok(model.relations.some(relation =>
      relation.type === 'acts_on' && relation.from === 'Maya'
      && relation.to === 'Noah' && relation.action === sample.expected
    ), sample.language);
  }
});

test('does not invent a directed relation when the source action has no named target', () => {
  const model = buildSceneWorldModel([{
    characters: ['Maya', 'Noah'], storyDetail: 'Maya runs across the room.'
  }]);
  assert.equal(model.relations.filter(relation => relation.type === 'acts_on').length, 0);
});


test('auto-detects Spanish source text when the scene language is unspecified', () => {
  const model = buildSceneWorldModel([{
    characters: ['Maya', 'Noah'],
    storyDetail: 'Maya ayuda a Noah.'
  }], { language: 'auto' });
  assert.ok(model.relations.some(relation =>
    relation.type === 'acts_on' && relation.from === 'Maya'
    && relation.to === 'Noah' && relation.action === 'help'
  ));
});

test('classifies action targets as props when state metadata identifies an object', () => {
  const model = buildSceneWorldModel([{
    id: 'object-action',
    characters: ['Mira', 'Noah'],
    storyDetail: 'Mira picks up the silver key and gives it to Noah.',
    stateChanges: [{
      entityType: 'prop', entityId: 'silver key', property: 'holder',
      previousValue: null, value: 'Mira', actorId: 'Mira',
      evidence: 'Mira picks up the silver key', actionIntent: 'pick_up'
    }],
    actionTimeline: {
      schemaVersion: 1,
      phases: [{
        phase: 'action', start: 0, end: 1, actorId: 'Mira', targetId: 'Noah',
        description: 'Mira gives the key to Noah.',
        evidence: 'Mira picks up the silver key',
        steps: [{
          intent: 'pick_up', motionCue: 'grasp', start: 0, end: 0.5,
          actorId: 'Mira', targetId: 'silver key',
          description: 'Mira picks up the silver key.',
          evidence: 'Mira picks up the silver key'
        }]
      }]
    }
  }]);
  assert.ok(model.entities.some(entity => entity.id === 'silver key' && entity.kind === 'prop'));
  assert.ok(model.entities.some(entity => entity.id === 'Noah' && entity.kind === 'character'));
  assert.equal(model.entities.filter(entity => entity.id === 'silver key' && entity.kind === 'character').length, 0);
});

test('adds only evidence-grounded physical object and contact relations', () => {
  const model = buildSceneWorldModel([{
    id: 'throw-catch',
    characters: ['Mira', 'Noah'],
    storyDetail: 'Mira throws the ball to Noah. Noah catches the ball.',
    physicsEvents: [
      { id: 'throw', type: 'throw', entityId: 'ball', actorId: 'Mira', targetId: 'Noah',
        evidence: 'Mira throws the ball to Noah.' },
      { id: 'catch', type: 'catch', entityId: 'ball', actorId: 'Noah', targetId: 'ball',
        evidence: 'Noah catches the ball.' },
      { id: 'invented', type: 'collision', entityId: 'ball', otherEntityId: 'wall',
        evidence: 'The ball crashes through a wall.' }
    ]
  }]);
  assert.ok(model.entities.some(entity => entity.id === 'ball' && entity.kind === 'prop'));
  assert.ok(model.entities.some(entity => entity.id === 'Mira' && entity.kind === 'character'));
  assert.ok(model.entities.some(entity => entity.id === 'Noah' && entity.kind === 'character'));
  assert.ok(model.relations.some(relation => relation.type === 'physical_action'
    && relation.from === 'Mira' && relation.to === 'ball' && relation.action === 'throw'));
  assert.ok(model.relations.some(relation => relation.type === 'physical_action'
    && relation.from === 'Noah' && relation.to === 'ball' && relation.action === 'catch'));
  assert.equal(model.entities.some(entity => entity.id === 'wall'), false);
});

test('retains persistent prop state snapshots in subsequent scene events', () => {
  const model = buildSceneWorldModel([
    { id: 's1', characters: ['Foxy'], storyDetail: 'Foxy picks up the silver key.',
      stateChanges: [{ entityType: 'prop', entityId: 'silver key', property: 'holder',
        previousValue: null, value: 'Foxy', actorId: 'Foxy', evidence: 'Foxy picks up the silver key.' }] },
    { id: 's2', characters: ['Foxy'], storyDetail: 'Foxy walks through the gate.',
      stateSnapshot: [{ entityType: 'prop', entityId: 'silver key', property: 'holder',
        previousValue: 'Foxy', value: 'Foxy', actorId: 'Foxy', snapshot: true,
        evidence: 'Foxy picks up the silver key.' }] }
  ]);
  assert.ok(model.events[1].actions.some(action => action.type === 'state_snapshot'
    && action.entityId === 'silver key' && action.value === 'Foxy'));
  assert.equal(model.validation.stateContinuityConflicts.length, 0);
});

test('ignores explicit interaction and state metadata without matching source evidence', () => {
  const model = buildSceneWorldModel([{
    id: 'untrusted',
    characters: ['Mira', 'Noah'],
    storyDetail: 'Mira looks at the ball.',
    interaction: { type: 'attack', actorId: 'Mira', targetId: 'Noah',
      evidence: 'Mira attacks Noah.' },
    stateChanges: [{ entityType: 'prop', entityId: 'secret key', property: 'holder',
      previousValue: null, value: 'Mira', actorId: 'Mira', evidence: 'Mira picks up the secret key.' }]
  }]);
  assert.equal(model.relations.some(relation => relation.from === 'Mira' && relation.to === 'Noah'), false);
  assert.equal(model.entities.some(entity => entity.id === 'secret key'), false);
});

test('ignores action timeline edges whose named target is absent from the evidence', () => {
  const model = buildSceneWorldModel([{
    id: 'bad-target',
    characters: ['Mira', 'Noah'],
    storyDetail: 'Mira throws the ball to Noah.',
    actionTimeline: {
      schemaVersion: 1,
      phases: [{
        phase: 'action', start: 0, end: 1, actorId: 'Mira', targetId: 'wall',
        description: 'Mira throws the ball to Noah.',
        evidence: 'Mira throws the ball to Noah.'
      }]
    }
  }]);
  assert.equal(model.relations.some(relation => relation.type === 'acts_on'
    && relation.from === 'Mira' && relation.to === 'wall'), false);
});

test('does not accept a persistent snapshot without a matching prior world state', () => {
  const model = buildSceneWorldModel([{
    id: 'unseeded-snapshot',
    characters: ['Foxy'],
    storyDetail: 'Foxy walks through the gate.',
    stateSnapshot: [{ entityType: 'prop', entityId: 'magic key', property: 'holder',
      previousValue: null, value: 'Foxy', actorId: 'Foxy', snapshot: true,
      evidence: 'Foxy picked up the magic key.' }]
  }]);
  assert.equal(model.entities.some(entity => entity.id === 'magic key'), false);
  assert.equal(model.events[0].actions.some(action => action.type === 'state_snapshot'), false);
});

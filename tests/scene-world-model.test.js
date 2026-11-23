import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneWorldModel } from '../src/scene-world-model.js';
import { normalizeScene } from '../src/scene-model.js';

test('builds the same directed interaction model for people, animals and robots', () => {
  const model = buildSceneWorldModel([
    { id: 's1', characters: ['Maya', 'Noah'], storyDetail: 'Maya gives Noah a phone.',
      interaction: { type: 'give', actorId: 'Maya', targetId: 'Noah', evidence: 'Maya gives Noah a phone' },
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
    { id: 's1', characters: ['Driver'], location: 'Garage',
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
    { id: 's1', characters: ['Maya'], stateChanges: [
      { entityType: 'prop', entityId: 'key', property: 'holder', previousValue: null, value: 'Maya', actorId: 'Maya' }
    ] },
    { id: 's2', characters: ['Noah'], stateChanges: [
      { entityType: 'prop', entityId: 'key', property: 'holder', previousValue: 'Noah', value: null, actorId: 'Noah' }
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


test('preserves causal and physics references when normalizing prop state changes', () => {
  const scene = normalizeScene({ stateChanges: [{
    entityType: 'prop', entityId: 'ball', property: 'holder',
    previousValue: 'Maya', value: 'Noah', actorId: 'Maya', targetId: 'Noah',
    causedByEventId: 'handoff-1', physicsEventId: 'contact-1',
    fromEntityId: 'Maya', toEntityId: 'Noah',
    gripHand: 'leftHand', fromGripHand: 'rightHand', toGripHand: 'leftHand',
    evidence: 'Maya hands the ball to Noah.', actionIntent: 'give'
  }] });
  assert.deepEqual(scene.stateChanges[0], {
    entityType: 'prop', entityId: 'ball', property: 'holder',
    previousValue: 'Maya', value: 'Noah', actorId: 'Maya', targetId: 'Noah',
    causedByEventId: 'handoff-1', physicsEventId: 'contact-1',
    fromEntityId: 'Maya', toEntityId: 'Noah',
    gripHand: 'leftHand', fromGripHand: 'rightHand', toGripHand: 'leftHand',
    evidence: 'Maya hands the ball to Noah.', actionIntent: 'give'
  });
});

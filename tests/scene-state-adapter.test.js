import test from 'node:test';
import assert from 'node:assert/strict';
import { toStructuredStateChanges } from '../src/scene-state-adapter.js';
import { normalizeObjectState, normalizeStateChanges } from '../src/scene-state-contract.js';

test('maps possession to holder without confusing it with ownership', () => {
  const [change] = toStructuredStateChanges([{
    entityType: 'prop', entityId: 'silver key', property: 'holder',
    previousValue: null, value: 'Foxy', actorId: 'Foxy', evidence: 'Foxy picks up the silver key.'
  }]);
  assert.equal(change.entity, 'silver key');
  assert.equal(change.property, 'holder');
  assert.equal(change.value, 'Foxy');
  assert.equal(normalizeStateChanges([change], { kindResolver: () => 'object' }).ok, true);
  assert.equal(normalizeObjectState({ holder: 'Foxy', owner: null, state: 'held' }).holder, 'Foxy');
});

test('maps open/closed state and character location into contract properties', () => {
  const changes = toStructuredStateChanges([
    { entityType: 'prop', entityId: 'gate', property: 'openState', previousValue: null, value: 'open', actorId: 'Foxy', evidence: 'Foxy opens the gate.' },
    { entityType: 'character', entityId: 'Foxy', property: 'location', previousValue: null, value: 'inside:cave', actorId: 'Foxy', evidence: 'Foxy enters the cave.' }
  ]);
  assert.deepEqual(changes.map(change => [change.entity, change.property, change.value]), [
    ['gate', 'state', 'open'], ['Foxy', 'location', 'inside:cave']
  ]);
});

test('preserves explicit possession release while dropping unsupported or incomplete changes', () => {
  assert.deepEqual(toStructuredStateChanges([
    { entityType: 'prop', entityId: 'key', property: 'owner', value: 'Foxy' },
    { entityType: 'prop', entityId: '', property: 'holder', value: 'Foxy' },
    { entityType: 'prop', entityId: 'key', property: 'holder', previousValue: 'Foxy', value: null, actorId: 'Foxy', evidence: 'Foxy drops the key.' }
  ]).map(change => [change.entity, change.property, change.value]), [
    ['key', 'holder', null]
  ]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { inferProceduralEnvironment } from '../src/procedural-scene-environment.js';

test('infers forest backgrounds from English, Russian, and Ukrainian scene details', () => {
  assert.equal(inferProceduralEnvironment({ storyDetail: 'The fox runs through a forest.' }), 'forest');
  assert.equal(inferProceduralEnvironment({ location: 'Тёмный лес' }), 'forest');
  assert.equal(inferProceduralEnvironment({ environmentDescription: 'Густий ліс біля річки' }), 'forest');
});

test('recognizes distinct castle, cave, beach, and city settings', () => {
  assert.equal(inferProceduralEnvironment({ title: 'The old castle' }), 'castle');
  assert.equal(inferProceduralEnvironment({ location: 'Подземная пещера' }), 'cave');
  assert.equal(inferProceduralEnvironment({ storyDetail: 'Waves reach the beach.' }), 'beach');
  assert.equal(inferProceduralEnvironment({ prompt: 'A chase through the city streets.' }), 'city');
});

test('uses grounded scene fields and falls back safely for unknown settings', () => {
  assert.equal(inferProceduralEnvironment({ location: 'Somewhere', storyDetail: 'The palace doors open.' }), 'castle');
  assert.equal(inferProceduralEnvironment({ title: 'A new adventure' }), 'hills');
  assert.equal(inferProceduralEnvironment(null), 'hills');
});

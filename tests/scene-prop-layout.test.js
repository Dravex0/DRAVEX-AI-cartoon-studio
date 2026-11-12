import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeterministicScenePropAnchors } from '../src/scene-prop-layout.js';
import { buildStoryboardFromText } from '../src/storyboard-generator.js';

test('does not assign positions to objects absent from source-grounded prop state', () => {
  assert.deepEqual(buildDeterministicScenePropAnchors({
    storyDetail: 'Kel looks across a quiet clearing.'
  }), {});
});

test('places only locked props and preserves valid director-authored anchors', () => {
  const anchors = buildDeterministicScenePropAnchors({
    stateChanges: [
      { entityType: 'prop', entityId: 'small mechanical bird', property: 'state', value: 'trapped' },
      { entityType: 'character', entityId: 'Kel', property: 'location', value: 'inside:forest' }
    ],
    propAnchors: {
      'small mechanical bird': { x: 0.47, y: 0.74 },
      'invented treasure chest': { x: 0.2, y: 0.5 }
    }
  });
  assert.deepEqual(anchors, {
    'small mechanical bird': { x: 0.47, y: 0.74 }
  });
});

test('creates a paired bird-under-branch layout and carries both props across three rescue scenes', () => {
  const storyboard = buildStoryboardFromText(
    'Characters:\nKel — a young forest adventurer in a dark green cloak.\n\nScene 1: Discovery\nKel notices the small mechanical bird trapped under a fallen branch.\n\nScene 2: Lifting the branch\nKel carefully lifts the fallen branch while watching the bird.\n\nScene 3: Freedom\nKel frees the small mechanical bird.',
    'en',
    'Kel'
  );

  assert.equal(storyboard.scenes.length, 3);
  const [discovery, lifting, freedom] = storyboard.scenes;
  assert.deepEqual(discovery.propAnchors, {
    'small mechanical bird': { x: 0.54, y: 0.755 },
    'fallen branch': { x: 0.54, y: 0.715 }
  });
  assert.ok(lifting.propAnchors['small mechanical bird']);
  assert.ok(lifting.propAnchors['fallen branch']);
  assert.ok(freedom.propAnchors['small mechanical bird']);
  assert.ok(freedom.propAnchors['fallen branch']);
  assert.ok(freedom.propStates.some(state =>
    state.entityId === 'fallen branch' && state.property === 'state' && state.value === 'lifted'
  ));
  assert.ok(freedom.propStates.some(state =>
    state.entityId === 'small mechanical bird' && state.property === 'state' && state.value === 'free'
  ));
});

test('recognizes prompt-defined cast for state tracking without a selected-character field', () => {
  const storyboard = buildStoryboardFromText(
    'Characters:\nKel — a forest adventurer.\n\nScene 1: Discovery\nKel notices a small mechanical bird trapped under a fallen branch.\n\nScene 2: Rescue\nKel frees the small mechanical bird.',
    'en',
    ''
  );
  assert.ok(storyboard.scenes.every(scene => scene.characters.includes('Kel')));
  assert.ok(storyboard.scenes[0].propAnchors['small mechanical bird']);
});


test('fills a missing locked prop anchor without moving the director-authored point', () => {
  const anchors = buildDeterministicScenePropAnchors({
    stateChanges: [
      { entityType: 'prop', entityId: 'small mechanical bird', property: 'state', value: 'trapped' },
      { entityType: 'prop', entityId: 'fallen branch', property: 'state', value: 'fallen' }
    ],
    propAnchors: { 'small mechanical bird': { x: 0.48, y: 0.76 } }
  });
  assert.deepEqual(anchors, {
    'small mechanical bird': { x: 0.48, y: 0.76 },
    'fallen branch': { x: 0.54, y: 0.715 }
  });
});

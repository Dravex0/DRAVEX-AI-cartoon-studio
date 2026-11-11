import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorldMotionInstructions } from '../src/world-motion-contract.js';

test('world motion contract keeps explicit sky, wind, and crowd movement distinct', () => {
  const prompt = buildWorldMotionInstructions({
    environmentMotion: ['Clouds drift from left to right across the sky.', 'Wind bends the treetops and scatters leaves.', 'Two background villagers cross the bridge in opposite directions.']
  });
  assert.match(prompt, /Clouds drift from left to right/);
  assert.match(prompt, /Wind bends the treetops/);
  assert.match(prompt, /villagers cross the bridge/);
  assert.match(prompt, /independently of the camera/);
});

test('world motion contract translates explicit character-object interactions and prop state', () => {
  const prompt = buildWorldMotionInstructions({
    interactions: [{ type: 'rescue', actorId: 'Kel', targetId: 'mechanical bird', evidence: 'Kel frees the mechanical bird.' }],
    stateChanges: [{ entityType: 'prop', entityId: 'fallen branch', property: 'holder', value: 'Kel', actorId: 'Kel' }]
  });
  assert.match(prompt, /Kel.*rescue.*mechanical bird/);
  assert.match(prompt, /fallen branch.*holder.*Kel/);
  assert.match(prompt, /contact must occur before an object moves/);
});

test('world motion contract does not invent movement when no explicit cues exist', () => {
  assert.equal(buildWorldMotionInstructions({ environmentDescription: 'A quiet forest clearing.' }), '');
});

test('world motion contract ignores incomplete interaction records', () => {
  assert.equal(buildWorldMotionInstructions({ interactions: [{ actorId: 'Kel', type: 'push' }] }), '');
});

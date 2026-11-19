import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSceneProductionInstructions } from '../src/scene-production-instructions.js';

test('formats grounded entities, directed relations, action beats and prop transitions for video providers', () => {
  const instructions = buildSceneProductionInstructions({
    sceneId: 'scene-1',
    worldEntities: [
      { id: 'fox', kind: 'animal', attributes: { color: 'orange' } },
      { id: 'robot', kind: 'robot', attributes: { arm: 'metal' } },
      { id: 'key', kind: 'prop', attributes: { state: 'on-table' } }
    ],
    worldRelations: [{ sceneId: 'scene-1', fromEntityId: 'fox', toEntityId: 'robot', type: 'looks-at' }],
    actionBeats: [{ phase: 'handoff', start: 0.2, end: 0.8, actorId: 'fox', targetId: 'robot', description: 'Fox gives the key to robot', evidence: 'story text' }],
    propActions: [{ entityId: 'key', property: 'holder', previousValue: 'fox', value: 'robot', actorId: 'fox', actionIntent: 'handoff' }],
    physicalBeats: [{ type: 'contact', grounded: true, actorId: 'fox', targetId: 'robot' }],
    causalBeats: [{ cause: 'key handed over', effect: 'robot holds key', grounded: true }],
    shots: [{ id: 'shot-1', startSeconds: 0, endSeconds: 2, framing: 'medium two-shot' }],
    dialogue: [{ characterId: 'fox', text: 'Take this key.' }],
    audioCues: [{ type: 'foley', startSeconds: 0.5, description: 'soft metal clink' }],
    continuity: { startState: 'Fox holds the key', endState: 'Robot holds the key', stateChanges: [] },
    requiredPasses: ['multi-entity-interaction', 'prop-state-and-motion']
  });

  assert.match(instructions, /fox/);
  assert.match(instructions, /robot/);
  assert.match(instructions, /looks-at/);
  assert.match(instructions, /handoff/);
  assert.match(instructions, /previousValue/);
  assert.match(instructions, /Take this key/);
  assert.match(instructions, /soft metal clink/);
  assert.match(instructions, /show cause before effect/);
  assert.match(instructions, /not proof that the provider supports/);
});

test('returns no extra provider instruction when no validated production plan exists', () => {
  assert.equal(buildSceneProductionInstructions(null), '');
  assert.equal(buildSceneProductionInstructions([]), '');
  assert.equal(buildSceneProductionInstructions({ sceneId: 'empty' }), [
    'GROUNDED SCENE PRODUCTION WORK ORDER',
    'Treat the following as the authoritative scene specification. Do not invent entities, props, actions, dialogue, causal events, or state changes.',
    "Execution constraints: keep each entity identity and appearance consistent with its supplied attributes; keep all listed characters and entities visually distinct; show every supplied causal event in its declared order; distinguish this scene's events from prior/future continuity context; show cause before effect; maintain object ownership and contact through handoffs; preserve physical direction and scene continuity; make each timed beat visibly legible; do not replace character action with camera movement or a static background. Treat the previous-scene ending as continuity evidence, not as an instruction to replay it.",
    'This is a provider instruction, not proof that the provider supports or has completed every requested pass.'
  ].join('\n'));
});


test('passes the ordered cross-scene causal sequence with current-scene markers to providers', () => {
  const instructions = buildSceneProductionInstructions({
    sceneId: 'scene-impact',
    causalChainDetails: [{
      chainId: 'push-to-fall',
      events: [
        { id: 'push', sceneId: 'scene-start', sequence: 1, type: 'action',
          actorId: 'Mira', entityId: 'cart', evidence: 'Mira pushes the cart.',
          occursInCurrentScene: false },
        { id: 'impact', sceneId: 'scene-impact', sequence: 2, type: 'physical_event',
          entityId: 'cart', targetId: 'crate', physicsEventId: 'collision-1',
          evidence: 'The cart hits the crate.', occursInCurrentScene: true },
        { id: 'fall', sceneId: 'scene-impact', sequence: 3, type: 'effect',
          entityId: 'crate', evidence: 'The crate falls.', occursInCurrentScene: true }
      ]
    }]
  });

  assert.match(instructions, /Ordered grounded causal interaction chains/);
  assert.ok(instructions.indexOf('"id":"push"') < instructions.indexOf('"id":"impact"'));
  assert.ok(instructions.indexOf('"id":"impact"') < instructions.indexOf('"id":"fall"'));
  assert.match(instructions, /"occursInCurrentScene":false/);
  assert.match(instructions, /"occursInCurrentScene":true/);
  assert.match(instructions, /collision-1/);
});

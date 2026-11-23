import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterRigTimelineFromActionTimeline } from '../src/character-rig-action-planner.js';
import { sampleCharacterRigTimeline } from '../src/character-rig-timeline.js';
import { buildScenePropRenderPlan, resolveCharacterPropAnchor } from '../src/scene-prop-renderer.js';

const rig = {
  schemaVersion: 1,
  characterId: 'Foxy',
  bones: [
    { id: 'root', parentId: null },
    { id: 'rightArm', parentId: 'root', pivotX: 0.5, pivotY: 0.4 },
    { id: 'rightForearm', parentId: 'rightArm', pivotX: 0.65, pivotY: 0.4 },
    { id: 'rightHand', parentId: 'rightForearm', pivotX: 0.8, pivotY: 0.4 }
  ],
  parts: [
    { id: 'body', boneId: 'root', imageUrl: 'https://assets.example/body.png', x: 0.5, y: 0.5 },
    {
      id: 'rightHand', boneId: 'rightHand', imageUrl: 'https://assets.example/hand.png',
      x: 0.8, y: 0.4, width: 0.06, height: 0.06, gripAnchor: true
    }
  ]
};

test('keeps a picked-up prop attached to the same animated hand through the next action', () => {
  const story = 'Foxy picks up the silver key and waves with the key in hand.';
  const pickupEvidence = 'Foxy picks up the silver key';
  const scene = {
    characters: ['Foxy'],
    characterCastProvided: true,
    storyDetail: story,
    actionTimeline: {
      schemaVersion: 1,
      phases: [{
        phase: 'action',
        start: 0.2,
        end: 0.95,
        actorId: 'Foxy',
        description: story,
        evidence: story,
        steps: [
          {
            intent: 'pick_up',
            motionCue: 'turn',
            start: 0.2,
            end: 0.55,
            actorId: 'Foxy',
            targetId: 'silver key',
            targetPosition: { x: 0.72, y: 0.55 },
            gripHand: 'rightHand',
            description: 'Foxy picks up the silver key',
            evidence: pickupEvidence
          },
          {
            intent: 'wave',
            motionCue: 'wave',
            start: 0.65,
            end: 0.9,
            actorId: 'Foxy',
            description: 'Foxy waves with the key in hand',
            evidence: 'Foxy waves with the key in hand'
          }
        ]
      }]
    },
    stateChanges: [{
      entityType: 'prop',
      entityId: 'silver key',
      property: 'holder',
      previousValue: null,
      value: 'Foxy',
      actorId: 'Foxy',
      actionIntent: 'pick_up',
      gripHand: 'rightHand',
      position: { x: 0.72, y: 0.55 },
      evidence: pickupEvidence
    }]
  };

  const compiled = createCharacterRigTimelineFromActionTimeline(scene, [rig]);
  assert.equal(compiled.status, 'generated', JSON.stringify(compiled));
  assert.equal(compiled.generatedCount, 2);
  assert.equal(compiled.mappedActions[0].targetedReach, 'solved');

  const layers = [{ characterId: 'Foxy', x: 0.5, y: 0.68 }];
  const runtimeAt = progress => {
    const rigPoses = sampleCharacterRigTimeline(compiled.timeline, progress);
    const anchor = resolveCharacterPropAnchor('Foxy', [rig], rigPoses, 'rightHand');
    const prop = buildScenePropRenderPlan(scene, layers, progress, {
      characterRigs: [rig],
      rigPoses
    }).find(item => item.id === 'silver key');
    return { anchor, prop };
  };

  const heldBeforeWave = runtimeAt(0.55);
  const heldDuringWave = runtimeAt(0.78);
  assert.ok(heldBeforeWave.anchor);
  assert.ok(heldDuringWave.anchor);
  assert.ok(heldBeforeWave.prop?.held);
  assert.ok(heldDuringWave.prop?.held);
  assert.ok(
    Math.hypot(
      heldDuringWave.anchor.x - heldBeforeWave.anchor.x,
      heldDuringWave.anchor.y - heldBeforeWave.anchor.y
    ) > 0.01,
    'the hand should visibly move during the following wave action'
  );
  assert.ok(Math.abs(heldDuringWave.prop.x - heldDuringWave.anchor.x) < 1e-9);
  assert.ok(Math.abs(heldDuringWave.prop.y - heldDuringWave.anchor.y) < 1e-9);
});

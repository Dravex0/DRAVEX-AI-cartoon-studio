import test from 'node:test';
import assert from 'node:assert/strict';
import { directStoryboardWithLocalAI } from '../src/local-story-director.js';

test('director exposes the grounded physics model when local inference is unavailable', async () => {
  const basePlan = { scenes: [{
    id: 'scene_1',
    characters: ['Maya'],
    storyDetail: 'Maya pushes the cart two meters forward.',
    visibleAction: 'Maya pushes the cart two meters forward.',
    physicsEvents: [{
      id: 'cart_move',
      type: 'motion',
      entityId: 'cart',
      startPosition: { x: 0, y: 0, z: 0 },
      endPosition: { x: 2, y: 0, z: 0 },
      durationSeconds: 1,
      evidence: 'Maya pushes the cart two meters forward.'
    }]
  }] };

  const result = await directStoryboardWithLocalAI({ basePlan });
  assert.equal(result.usedLocalModel, false);
  assert.equal(result.physicsModel.eventCount, 1);
  assert.equal(result.physicsModel.groundedEventCount, 1);
  assert.equal(result.productionPlan.sceneCount, 1);
  assert.ok(result.productionPlan.scenes[0].requiredPasses.includes('character-layer-composition'));
  assert.deepEqual(result.physicsModel.events[0].derivedMotion.averageVelocityMps, {
    x: 2, y: 0, z: 0
  });
});

test('director gives the local model physics constraints and locked source events', async () => {
  let capturedPrompt = '';
  const runtime = {
    status: { modelId: 'test-model' },
    async generate(prompt) {
      capturedPrompt = prompt;
      return { text: 'not valid scene JSON' };
    }
  };
  const basePlan = { scenes: [{
    id: 'scene_1',
    characters: ['Maya'],
    storyDetail: 'The cup falls from the table.',
    visibleAction: 'The cup falls from the table.',
    physicsEvents: [{
      id: 'cup_fall',
      type: 'fall',
      entityId: 'cup',
      evidence: 'The cup falls from the table.'
    }]
  }] };

  const result = await directStoryboardWithLocalAI({ runtime, basePlan });
  assert.equal(result.fallbackReason, 'invalid-model-scene-structure');
  assert.match(capturedPrompt, /PHYSICS MODEL \(source-grounded only\)/);
  assert.match(capturedPrompt, /Never invent collisions, falls, contact, support/);
  assert.match(capturedPrompt, /FILM LANGUAGE AND COVERAGE/);
  assert.match(capturedPrompt, /CONTINUITY GRAMMAR/);
  assert.match(capturedPrompt, /EDITING KNOWLEDGE/);
  assert.match(capturedPrompt, /LOCKED SEMANTIC SHOT PLAN/);
  assert.match(capturedPrompt, /LOCKED EDITORIAL DECISIONS/);
  assert.match(capturedPrompt, /180-degree line/);
  assert.match(capturedPrompt, /LOCKED SCENE PRODUCTION BLUEPRINT/);
  assert.match(capturedPrompt, /renderer actually produces its output/);
  assert.match(capturedPrompt, /cup_fall/);
  assert.equal(result.physicsModel.events[0].grounded, true);
});

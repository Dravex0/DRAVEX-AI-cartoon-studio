import test from 'node:test';
import assert from 'node:assert/strict';
import { directStoryboardWithLocalAI } from '../src/local-story-director.js';

test('local director exposes editing plan even when optional local inference is unavailable', async () => {
  const basePlan = { scenes: [{
    id: 'scene_1', durationSeconds: 2, characters: ['Maya', 'Noah'],
    storyDetail: 'Maya helps Noah.', visibleAction: 'Maya helps Noah.',
    interaction: { type: 'help', actorId: 'Maya', targetId: 'Noah', evidence: 'Maya helps Noah.' },
    camera: 'Medium shot, eye-level'
  }] };
  const result = await directStoryboardWithLocalAI({ basePlan, language: 'English' });
  assert.equal(result.usedLocalModel, false);
  assert.equal(result.editingPlan.shotCount, 1);
  assert.equal(result.editingPlan.shots[0].continuity.participantIds.includes('Maya'), true);
  assert.equal(result.editingPlan.shots[0].continuity.relations[0].from, 'Maya');
  assert.equal(result.editDecisions.shotCount, 1);
  assert.deepEqual(result.editDecisions.cuts, []);
  assert.equal(result.editDecisions.pacing[0].pace, 'steady');
});

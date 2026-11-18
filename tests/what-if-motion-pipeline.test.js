import test from 'node:test';
import assert from 'node:assert/strict';
import { convertWhatIfEpisode } from '../src/what-if-episode-adapter.js';
import { planCharacterMotionFromActionTimeline } from '../src/character-motion-planner.js';
import { createCharacterRigTimelineFromActionTimeline } from '../src/character-rig-action-planner.js';
import { buildCharacterRigAssetPlan } from '../src/character-rig-asset-plan.js';
import { sampleCharacterRigTimeline } from '../src/character-rig-timeline.js';

function importedWalkScene() {
  const result = convertWhatIfEpisode({
    shots: [{
      say: 'The fox crosses the park.',
      actors: [{ who: 'fox', x: 20, toX: 80, pose: 'walk' }]
    }]
  }, { characterMap: { fox: 'main-character' } });
  assert.equal(result.diagnostics.ok, true);
  return result.scenes[0];
}

test('What-if directional walk produces a renderable whole-sprite motion timeline', () => {
  const scene = importedWalkScene();
  const result = planCharacterMotionFromActionTimeline(scene, [{
    characterId: 'main-character',
    x: 0.2, y: 0.7, scale: 1, rotation: 0, opacity: 1
  }]);

  assert.equal(result.status, 'generated');
  assert.equal(result.generatedCount, 1);
  assert.equal(result.timeline.phases[0].motion.from.x, 0.2);
  assert.ok(result.timeline.phases[0].motion.to.x > 0.2);
});

test('What-if directional walk maps to articulated bone animation when a matching rig exists', () => {
  const scene = importedWalkScene();
  const plan = buildCharacterRigAssetPlan({
    characterId: 'main-character',
    appearanceReference: 'A friendly orange fox with a cream muzzle and green scarf'
  });
  const rig = {
    ...plan.rig,
    parts: plan.rig.parts.map(part => ({
      ...part,
      imageUrl: 'https://assets.example/' + part.id + '.png'
    }))
  };

  const result = createCharacterRigTimelineFromActionTimeline(scene, [rig]);
  assert.equal(result.status, 'generated');
  assert.equal(result.generatedCount, 1);
  assert.equal(result.mappedActions[0].preset, 'walk');

  const pose = sampleCharacterRigTimeline(result.timeline, 0.3)['main-character'];
  assert.ok(pose);
  assert.ok(Object.values(pose).some(bonePose =>
    Object.values(bonePose).some(value => Math.abs(value) > 0)
  ));
});

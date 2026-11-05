import test from 'node:test';
import assert from 'node:assert/strict';
import { createUniversalCapabilityRegistry } from '../src/universal-capability-registry.js';
import { executeUniversalTaskPlan } from '../src/universal-task-executor.js';

test('dependent voice capability becomes available after local dialogue generation', async () => {
  let dialogueReady = false;
  const registry = createUniversalCapabilityRegistry();
  registry.register({
    id: 'dialogue.generate',
    privacy: 'local',
    isAvailable: () => true,
    run: async () => {
      dialogueReady = true;
      return { type: 'scene-dialogue', scenes: 2 };
    }
  });
  registry.register({
    id: 'voice.generate',
    privacy: 'local',
    isAvailable: () => dialogueReady,
    run: async () => ({ type: 'local-voice-artifacts', scenes: 2 })
  });
  const plan = {
    schemaVersion: 1,
    sourceRequest: 'Create dialogue and voice for a short film',
    goal: 'Write dialogue and synthesize voices.',
    deliverable: { type: 'video', description: 'A film with dialogue and voice audio.' },
    steps: [
      { id: 'dialogue', action: 'Write dialogue for all scenes.', purpose: 'Create scene dialogue.', inputs: ['allScenes'], outputs: ['dialogue'], dependsOn: [], requiredCapabilities: ['dialogue.generate'] },
      { id: 'voice', action: 'Synthesize voices for all scenes.', purpose: 'Create local voice audio.', inputs: ['allScenes'], outputs: ['voice audio'], dependsOn: ['dialogue'], requiredCapabilities: ['voice.generate'] }
    ],
    constraints: [], requiredAssets: [], openQuestions: []
  };
  assert.equal(registry.isAvailable('voice.generate'), false);
  const result = await executeUniversalTaskPlan({ plan, handlers: registry.createHandlers() });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'completed');
  assert.equal(result.results.dialogue.scenes, 2);
  assert.equal(result.results.voice.scenes, 2);
});

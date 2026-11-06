import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAutomaticSpeechTasks } from '../src/automatic-speech-workflow.js';

const hash = 'a'.repeat(64);

test('does not add dialogue or voice when the prompt does not request speech', () => {
  const result = resolveAutomaticSpeechTasks({
    request: 'A fox runs through a forest at sunrise.',
    scenes: [{ id: 's1' }]
  });
  assert.equal(result.dialogueRequested, false);
  assert.equal(result.voiceRequested, false);
  assert.deepEqual(result.scenesMissingDialogue, []);
  assert.deepEqual(result.scenesMissingVoice, []);
});

test('recognizes Russian dialogue and voice requests', () => {
  const result = resolveAutomaticSpeechTasks({
    request: 'Сделай мультфильм с диалогами и озвучкой персонажей.',
    scenes: [{ id: 's1' }]
  });
  assert.equal(result.dialogueRequested, true);
  assert.equal(result.voiceRequested, true);
  assert.equal(result.scenesMissingDialogue.length, 1);
  assert.deepEqual(result.scenesMissingVoice, []);
});

test('preserves existing dialogue and detects only scenes missing voice artifacts', () => {
  const scenes = [
    {
      id: 'ready',
      dialogue: [{ characterId: 'Fox', text: 'Hello' }],
      voiceCues: [{ characterId: 'Fox', text: 'Hello', audioHash: hash, durationMs: 1200 }]
    },
    { id: 'needs-voice', dialogue: [{ characterId: 'Bird', text: 'Hi' }], voiceCues: [] },
    { id: 'needs-dialogue', dialogue: [], voiceCues: [] }
  ];
  const result = resolveAutomaticSpeechTasks({ request: 'Add spoken dialogue and voice audio.', scenes });
  assert.equal(result.scenesMissingDialogue.length, 1);
  assert.equal(result.scenesMissingDialogue[0].scene.id, 'needs-dialogue');
  assert.deepEqual(result.scenesMissingVoice, [{ sceneId: 'needs-voice', index: 1 }]);
});

test('does not accept mismatched, malformed, or incomplete voice cues as complete', () => {
  const scenes = [{
    id: 's1',
    dialogue: [{ characterId: 'Fox', text: 'Hello' }],
    voiceCues: [{ characterId: 'Fox', text: 'Goodbye', audioHash: hash, durationMs: 1200 }]
  }];
  const result = resolveAutomaticSpeechTasks({ request: 'Voice audio please.', scenes });
  assert.deepEqual(result.scenesMissingVoice, [{ sceneId: 's1', index: 0 }]);
});

test('handles invalid scene collections without throwing', () => {
  const result = resolveAutomaticSpeechTasks({ request: 'No dialogue', scenes: null });
  assert.deepEqual(result.scenesMissingDialogue, []);
  assert.deepEqual(result.scenesMissingVoice, []);
});

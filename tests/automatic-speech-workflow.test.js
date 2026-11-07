import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAutomaticSpeechTasks } from '../src/automatic-speech-workflow.js';
import { findScenesWithMissingVoiceAudio } from '../src/voice-artifact-readiness.js';

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

test('does not mistake speech bubbles or a music soundtrack for spoken voice audio', () => {
  const bubbles = resolveAutomaticSpeechTasks({
    request: 'Create speech bubbles and animated captions for the characters.',
    scenes: [{ id: 's1' }]
  });
  assert.equal(bubbles.dialogueRequested, false);
  assert.equal(bubbles.voiceRequested, false);

  const soundtrack = resolveAutomaticSpeechTasks({
    request: 'Add background music and audio effects to the film.',
    scenes: [{ id: 's1' }]
  });
  assert.equal(soundtrack.dialogueRequested, false);
  assert.equal(soundtrack.voiceRequested, false);
});


test('requires voice artifacts to match the active story language', () => {
  const scenes = [{
    id: 's1',
    dialogue: [{ characterId: 'Fox', text: 'Hello' }],
    voiceCues: [{ characterId: 'Fox', text: 'Hello', language: 'en', audioHash: hash, durationMs: 1200 }]
  }];
  assert.deepEqual(
    resolveAutomaticSpeechTasks({ request: 'Voice audio please.', scenes, language: 'ru' }).scenesMissingVoice,
    [{ sceneId: 's1', index: 0 }]
  );
  assert.deepEqual(
    resolveAutomaticSpeechTasks({ request: 'Voice audio please.', scenes, language: 'en' }).scenesMissingVoice,
    []
  );
});

test('detects voice WAVs evicted from local storage even when draft cues remain', async () => {
  const scenes = [
    {
      id: 'available',
      dialogue: [{ characterId: 'Fox', text: 'Hello' }],
      voiceCues: [{ characterId: 'Fox', text: 'Hello', audioHash: hash, durationMs: 1200 }]
    },
    {
      id: 'evicted',
      dialogue: [{ characterId: 'Bird', text: 'Hi' }],
      voiceCues: [{ characterId: 'Bird', text: 'Hi', audioHash: 'b'.repeat(64), durationMs: 900 }]
    }
  ];
  const storage = {
    async get(audioHash) {
      return audioHash === hash ? {
        audioHash: hash,
        blob: new Blob(['voice'], { type: 'audio/wav' }),
        mimeType: 'audio/wav',
        durationMs: 1200
      } : undefined;
    }
  };
  assert.deepEqual(await findScenesWithMissingVoiceAudio(scenes, storage), [{ sceneId: 'evicted', index: 1 }]);
});

test('does not claim voice storage is healthy when a cue points to an empty blob', async () => {
  const scenes = [{
    id: 'empty',
    dialogue: [{ characterId: 'Fox', text: 'Hello' }],
    voiceCues: [{ characterId: 'Fox', text: 'Hello', audioHash: hash, durationMs: 1200 }]
  }];
  assert.deepEqual(
    await findScenesWithMissingVoiceAudio(scenes, { get: async () => ({ blob: new Blob([]) }) }),
    [{ sceneId: 'empty', index: 0 }]
  );
});


test('recognizes Ukrainian dialogue and voice requests', () => {
  const result = resolveAutomaticSpeechTasks({
    request: 'Створи мультфільм із діалогами та озвученням персонажів.',
    scenes: [{ id: 'ua-scene' }]
  });
  assert.equal(result.dialogueRequested, true);
  assert.equal(result.voiceRequested, true);
  assert.equal(result.scenesMissingDialogue.length, 1);
});

test('recognizes Spanish dialogue and voice requests', () => {
  const result = resolveAutomaticSpeechTasks({
    request: 'Crea un cortometraje con diálogos y voces para los personajes.',
    scenes: [{ id: 'es-scene' }]
  });
  assert.equal(result.dialogueRequested, true);
  assert.equal(result.voiceRequested, true);
  assert.equal(result.scenesMissingDialogue.length, 1);
});


test('treats explicit lip-sync requests as requiring dialogue and voice artifacts', () => {
  for (const request of [
    'Create a cartoon with lip-sync.',
    'Add mouth sync to every character.',
    'Сделай синхронизацию губ персонажей.',
    'Додай синхронізацію губ персонажам.'
  ]) {
    const result = resolveAutomaticSpeechTasks({
      request,
      scenes: [{ id: 'lip-sync-scene' }]
    });
    assert.equal(result.dialogueRequested, true, request);
    assert.equal(result.voiceRequested, true, request);
    assert.equal(result.scenesMissingDialogue.length, 1, request);
    assert.deepEqual(result.scenesMissingVoice, [], request);
  }
});

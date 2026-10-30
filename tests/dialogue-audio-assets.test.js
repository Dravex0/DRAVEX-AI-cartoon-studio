import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDialogueAudioFilename } from '../src/dialogue-audio-assets.js';

test('parses supported one-based scene and dialogue filenames', () => {
  assert.deepEqual(parseDialogueAudioFilename('scene1_dialogue_1.mp3'), { sceneIndex: 0, lineId: 'dialogue_1' });
  assert.deepEqual(parseDialogueAudioFilename('SCENE12_DIALOGUE_3.WAV'), { sceneIndex: 11, lineId: 'dialogue_3' });
});

test('rejects malformed, unsafe and unsupported filenames', () => {
  for (const value of ['', null, 'scene0_dialogue_1.mp3', 'scene1_dialogue_0.mp3', 'scene1_hello.mp3', 'scene1_dialogue_1.mp3.exe', 'scene999999999999999999999_dialogue_1.mp3']) {
    assert.equal(parseDialogueAudioFilename(value), null);
  }
});

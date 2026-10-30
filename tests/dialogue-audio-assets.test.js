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


test('stable scene assignment keys survive scene reordering', async () => {
  const { getDialogueAudioAssignmentKey, mapDialogueAudioAssignmentsToSchedule } = await import('../src/dialogue-audio-assets.js');
  const foxFile = { name: 'fox.wav' };
  const birdFile = { name: 'bird.wav' };
  const assignments = new Map([
    [getDialogueAudioAssignmentKey('scene-fox', 'fox-line'), foxFile],
    [getDialogueAudioAssignmentKey('scene-bird', 'bird-line'), birdFile]
  ]);
  const reorderedScenes = [
    { id: 'scene-bird', dialogueTimeline: [{ id: 'bird-line' }] },
    { id: 'scene-fox', dialogueTimeline: [{ id: 'fox-line' }] }
  ];
  const schedule = [
    { sceneIndex: 0, lineId: 'bird-line' },
    { sceneIndex: 1, lineId: 'fox-line' }
  ];
  const mapped = mapDialogueAudioAssignmentsToSchedule(assignments, reorderedScenes, schedule);
  assert.equal(mapped.get('0:bird-line'), birdFile);
  assert.equal(mapped.get('1:fox-line'), foxFile);
});

test('ignores assignments belonging to deleted scenes or removed dialogue lines', async () => {
  const { getDialogueAudioAssignmentKey, mapDialogueAudioAssignmentsToSchedule } = await import('../src/dialogue-audio-assets.js');
  const oldFile = { name: 'old.wav' };
  const activeFile = { name: 'active.wav' };
  const assignments = new Map([
    [getDialogueAudioAssignmentKey('deleted-scene', 'old-line'), oldFile],
    [getDialogueAudioAssignmentKey('active-scene', 'removed-line'), oldFile],
    [getDialogueAudioAssignmentKey('active-scene', 'active-line'), activeFile]
  ]);
  const scenes = [{ id: 'active-scene' }];
  const schedule = [
    { sceneIndex: 0, lineId: 'active-line' },
    { sceneIndex: 0, lineId: 'new-line' }
  ];
  const mapped = mapDialogueAudioAssignmentsToSchedule(assignments, scenes, schedule);
  assert.deepEqual([...mapped.keys()], ['0:active-line']);
  assert.equal(mapped.get('0:active-line'), activeFile);
});

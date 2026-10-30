import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDialogueAudioSchedule, getActiveDialogueAudioCue, getDialogueSpeakers } from '../src/dialogue-audio.js';

test('converts scene-local dialogue times into global export offsets', () => {
  const schedule = buildDialogueAudioSchedule([
    { dialogueTimeline: [{ id: 'fox-1', characterId: 'Foxy', text: 'Hello', startSeconds: 0.5, endSeconds: 1.25 }] },
    { dialogueTimeline: [{ id: 'bird-1', characterId: 'Bird', text: 'Hi', startSeconds: 1, endSeconds: 2 }] }
  ], { segments: [
    { sceneIndex: 0, startMs: 0, durationMs: 3000 },
    { sceneIndex: 1, startMs: 3000, durationMs: 4000 }
  ] });
  assert.deepEqual(schedule, [
    { sceneIndex: 0, lineId: 'fox-1', characterId: 'Foxy', text: 'Hello', startMs: 500, endMs: 1250 },
    { sceneIndex: 1, lineId: 'bird-1', characterId: 'Bird', text: 'Hi', startMs: 4000, endMs: 5000 }
  ]);
});

test('clamps cues to scene duration and skips invalid or empty dialogue', () => {
  const schedule = buildDialogueAudioSchedule([
    { dialogueTimeline: [
      { id: 'outside', characterId: 'Foxy', text: 'Beyond', startSeconds: 2, endSeconds: 8 },
      { id: 'empty', characterId: 'Foxy', text: ' ', startSeconds: 0, endSeconds: 1 },
      { id: 'bad', characterId: '', text: 'No speaker', startSeconds: 0, endSeconds: 1 },
      { id: 'reverse', characterId: 'Foxy', text: 'Backwards', startSeconds: 1, endSeconds: 0.5 }
    ] }
  ], { segments: [{ sceneIndex: 0, startMs: 100, durationMs: 3000 }] });
  assert.deepEqual(schedule, [
    { sceneIndex: 0, lineId: 'outside', characterId: 'Foxy', text: 'Beyond', startMs: 2100, endMs: 3100 }
  ]);
});

test('finds the active cue with an exclusive end boundary', () => {
  const cues = [
    { sceneIndex: 0, lineId: 'a', startMs: 100, endMs: 300 },
    { sceneIndex: 1, lineId: 'b', startMs: 300, endMs: 500 }
  ];
  assert.equal(getActiveDialogueAudioCue(cues, 299).lineId, 'a');
  assert.equal(getActiveDialogueAudioCue(cues, 300).lineId, 'b');
  assert.equal(getActiveDialogueAudioCue(cues, 500), null);
  assert.equal(getActiveDialogueAudioCue(cues, NaN), null);
});

test('handles absent scenes, timelines and export segments safely', () => {
  assert.deepEqual(buildDialogueAudioSchedule(null, null), []);
  assert.deepEqual(buildDialogueAudioSchedule([{}], { segments: [{ sceneIndex: 0, startMs: 0, durationMs: 1000 }] }), []);
});

test('collects unique dialogue speakers across all scenes in first-seen order', () => {
  assert.deepEqual(getDialogueSpeakers([
    { dialogueTimeline: [{ characterId: 'Foxy' }, { characterId: 'Bird' }] },
    { dialogueTimeline: [{ characterId: 'foxy' }, { characterId: '  Fox  ' }, { characterId: '' }] },
    { dialogueTimeline: [{ characterId: 'Bird' }, { characterId: 'Fox' }] }
  ]), ['Foxy', 'Bird', 'Fox']);
  assert.deepEqual(getDialogueSpeakers(null), []);
});

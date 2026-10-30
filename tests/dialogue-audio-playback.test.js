import test from 'node:test';
import assert from 'node:assert/strict';
import { getDialogueAudioAssetKey, scheduleDialogueAudioBuffers } from '../src/dialogue-audio-playback.js';

function harness() {
  const calls = [];
  const destination = {};
  const context = {
    currentTime: 12,
    createGain() {
      return { gain: { value: 1 }, connect(target) { calls.push(['gain-connect', target]); }, disconnect() { calls.push(['gain-disconnect']); } };
    },
    createBufferSource() {
      return {
        connect(target) { calls.push(['connect', target]); },
        start(...args) { calls.push(['start', ...args]); },
        stop() { calls.push(['stop']); },
        disconnect() { calls.push(['disconnect']); }
      };
    }
  };
  return { calls, destination, context };
}

test('builds stable asset keys from scene and dialogue IDs', () => {
  assert.equal(getDialogueAudioAssetKey({ sceneIndex: 2, lineId: 'fox-1' }), '2:fox-1');
  assert.equal(getDialogueAudioAssetKey({ sceneIndex: 2, lineId: '  ' }), '');
  assert.equal(getDialogueAudioAssetKey(null), '');
});

test('schedules local buffers at global timeline offsets and clips to cue duration', () => {
  const h = harness();
  const buffer = { duration: 1.2 };
  const result = scheduleDialogueAudioBuffers({
    context: h.context,
    destination: h.destination,
    schedule: [
      { sceneIndex: 0, lineId: 'a', startMs: 500, endMs: 2000 },
      { sceneIndex: 1, lineId: 'b', startMs: 3000, endMs: 4500 }
    ],
    audioBuffers: new Map([['0:a', buffer], ['1:b', { duration: 3 }]])
  });
  assert.equal(result.scheduledCount, 2);
  const starts = h.calls.filter(call => call[0] === 'start');
  assert.deepEqual(starts, [
    ['start', 12.5, 0, 1.2],
    ['start', 15, 0, 1.5]
  ]);
});

test('skips missing or invalid assets without preventing valid cues', () => {
  const h = harness();
  const result = scheduleDialogueAudioBuffers({
    context: h.context,
    destination: h.destination,
    schedule: [
      { sceneIndex: 0, lineId: 'missing', startMs: 0, endMs: 1000 },
      { sceneIndex: 0, lineId: 'bad', startMs: 1000, endMs: 1000 },
      { sceneIndex: 0, lineId: 'valid', startMs: 2000, endMs: 3000 }
    ],
    audioBuffers: new Map([['0:valid', { duration: 2 }]])
  });
  assert.equal(result.scheduledCount, 1);
  assert.deepEqual(result.skipped, ['0:missing', '0:bad']);
});

test('uses supplied startAt and stops scheduled sources safely once', () => {
  const h = harness();
  const result = scheduleDialogueAudioBuffers({
    context: h.context,
    destination: h.destination,
    startAt: 4,
    schedule: [{ sceneIndex: 0, lineId: 'a', startMs: 250, endMs: 750 }],
    audioBuffers: new Map([['0:a', { duration: 1 }]])
  });
  assert.deepEqual(h.calls.find(call => call[0] === 'start'), ['start', 4.25, 0, 0.5]);
  result.stop();
  result.stop();
  assert.equal(h.calls.filter(call => call[0] === 'stop').length, 1);
  assert.equal(h.calls.filter(call => call[0] === 'disconnect').length, 1);
});

test('applies independent character voice volumes with safe clamping', () => {
  const h = harness();
  const result = scheduleDialogueAudioBuffers({
    context: h.context,
    destination: h.destination,
    schedule: [
      { sceneIndex: 0, lineId: 'fox', characterId: 'Foxy', startMs: 0, endMs: 1000 },
      { sceneIndex: 0, lineId: 'rabbit', characterId: 'Rabbit', startMs: 1000, endMs: 2000 },
      { sceneIndex: 0, lineId: 'bird', characterId: 'Bird', startMs: 2000, endMs: 3000 }
    ],
    audioBuffers: new Map([
      ['0:fox', { duration: 1 }],
      ['0:rabbit', { duration: 1 }],
      ['0:bird', { duration: 1 }]
    ]),
    characterVolumes: new Map([['foxy', 0.35], ['rabbit', 1.8], ['bird', -2]])
  });
  assert.equal(result.scheduledCount, 3);
  const gains = h.calls.filter(call => call[0] === 'gain-connect');
  assert.equal(gains.length, 3);
  // Gain values are inspected from the created nodes via the captured call target.
  assert.deepEqual(h.calls.filter(call => call[0] === 'connect').map(call => call[1].gain.value), [0.35, 1, 0]);
  result.stop();
  assert.equal(h.calls.filter(call => call[0] === 'gain-disconnect').length, 3);
});

test('rejects missing Web Audio dependencies', () => {
  assert.throws(() => scheduleDialogueAudioBuffers({}), /Audio context/);
  const h = harness();
  assert.throws(() => scheduleDialogueAudioBuffers({ context: h.context, schedule: [], audioBuffers: new Map() }), /destination/);
});

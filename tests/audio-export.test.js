import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioExportSession } from '../src/audio-export.js';

function createHarness() {
  const events = [];
  const videoTrack = { kind: 'video', stop() { events.push('video-stop'); } };
  const audioTrack = { kind: 'audio', stopped: false, stop() { this.stopped = true; events.push('audio-stop'); } };
  const destination = { stream: { getAudioTracks: () => [audioTrack] } };
  class FakeAudioContext {
    state = 'suspended';
    createMediaElementSource() { return { connect(node) { events.push('source-connect'); } }; }
    createGain() { return { gain: { value: 0 }, connect(node) { events.push('gain-connect'); } }; }
    createMediaStreamDestination() { return destination; }
    async resume() { events.push('resume'); this.state = 'running'; }
    async close() { events.push('close'); this.state = 'closed'; }
  }
  class FakeMediaStream {
    constructor(tracks) { this.tracks = tracks; }
    getTracks() { return this.tracks; }
  }
  const audioElement = {
    currentTime: 4,
    async play() { events.push('play'); },
    pause() { events.push('pause'); }
  };
  return { events, videoTrack, audioTrack, destination, FakeAudioContext, FakeMediaStream, audioElement };
}

test('mixes canvas video and one audio track into a recording stream', async () => {
  const h = createHarness();
  const session = await createAudioExportSession({
    videoStream: { getTracks: () => [h.videoTrack] },
    audioElement: h.audioElement,
    volume: 0.7,
    AudioContextClass: h.FakeAudioContext,
    MediaStreamClass: h.FakeMediaStream
  });
  assert.deepEqual(session.stream.getTracks().map(track => track.kind), ['video', 'audio']);
  assert.deepEqual(h.events.slice(0, 2), ['source-connect', 'gain-connect']);
  await session.start();
  assert.ok(h.events.includes('resume'));
  assert.ok(h.events.includes('play'));
  await session.cleanup();
  assert.equal(h.audioTrack.stopped, true);
  assert.equal(h.audioElement.currentTime, 0);
  assert.ok(h.events.includes('close'));
});

test('clamps invalid and out-of-range volume values safely', async () => {
  for (const [value, expected] of [[-4, 0], [4, 1], ['not-a-number', 1]]) {
    const h = createHarness();
    const gains = [];
    class InspectContext extends h.FakeAudioContext {
      createGain() {
        const node = super.createGain();
        gains.push(node);
        return node;
      }
    }
    const session = await createAudioExportSession({
      videoStream: { getTracks: () => [h.videoTrack] },
      audioElement: h.audioElement,
      volume: value,
      AudioContextClass: InspectContext,
      MediaStreamClass: h.FakeMediaStream
    });
    assert.equal(gains[0].gain.value, expected);
    await session.cleanup();
  }
});

test('rejects missing media inputs and unsupported Web Audio', async () => {
  await assert.rejects(() => createAudioExportSession({}), /video MediaStream/);
  const h = createHarness();
  await assert.rejects(() => createAudioExportSession({
    videoStream: { getTracks: () => [h.videoTrack] },
    audioElement: h.audioElement,
    AudioContextClass: null,
    MediaStreamClass: h.FakeMediaStream
  }), /Web Audio is not supported/);
});

test('cleanup is safe to call more than once', async () => {
  const h = createHarness();
  const session = await createAudioExportSession({
    videoStream: { getTracks: () => [h.videoTrack] },
    audioElement: h.audioElement,
    AudioContextClass: h.FakeAudioContext,
    MediaStreamClass: h.FakeMediaStream
  });
  await session.cleanup();
  await session.cleanup();
  assert.equal(h.events.filter(event => event === 'close').length, 1);
});

test('mixes multiple local audio tracks with independent volume and lifecycle', async () => {
  const h = createHarness();
  const dialogue = {
    currentTime: 2,
    async play() { h.events.push('dialogue-play'); },
    pause() { h.events.push('dialogue-pause'); }
  };
  const music = {
    currentTime: 7,
    async play() { h.events.push('music-play'); },
    pause() { h.events.push('music-pause'); }
  };
  const gains = [];
  class MultiTrackContext extends h.FakeAudioContext {
    createGain() {
      const node = super.createGain();
      gains.push(node);
      return node;
    }
  }
  const session = await createAudioExportSession({
    videoStream: { getTracks: () => [h.videoTrack] },
    audioTracks: [
      { audioElement: dialogue, volume: 0.9 },
      { audioElement: music, volume: 0.25 }
    ],
    AudioContextClass: MultiTrackContext,
    MediaStreamClass: h.FakeMediaStream
  });

  assert.deepEqual(gains.map(node => node.gain.value), [0.9, 0.25]);
  await session.start();
  assert.ok(h.events.includes('dialogue-play'));
  assert.ok(h.events.includes('music-play'));
  await session.cleanup();
  assert.equal(dialogue.currentTime, 0);
  assert.equal(music.currentTime, 0);
  assert.ok(h.events.includes('dialogue-pause'));
  assert.ok(h.events.includes('music-pause'));
});

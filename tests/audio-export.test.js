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


test('concurrent start calls share one playback operation', async () => {
  const h = createHarness();
  let resolveResume;
  class DelayedResumeContext extends h.FakeAudioContext {
    resume() {
      h.events.push('resume');
      return new Promise(resolve => {
        resolveResume = () => {
          this.state = 'running';
          resolve();
        };
      });
    }
  }
  const session = await createAudioExportSession({
    videoStream: { getTracks: () => [h.videoTrack] },
    audioElement: h.audioElement,
    AudioContextClass: DelayedResumeContext,
    MediaStreamClass: h.FakeMediaStream
  });

  const firstStart = session.start();
  const secondStart = session.start();
  assert.equal(firstStart, secondStart);
  assert.equal(h.events.filter(event => event === 'resume').length, 1);

  resolveResume();
  await Promise.all([firstStart, secondStart]);
  assert.equal(h.events.filter(event => event === 'play').length, 1);
  await session.cleanup();
});

test('rolls audio back when play throws synchronously', async () => {
  const h = createHarness();
  h.audioElement.play = () => {
    h.events.push('play-throws');
    throw new Error('synchronous playback failure');
  };
  const session = await createAudioExportSession({
    videoStream: { getTracks: () => [h.videoTrack] },
    audioElement: h.audioElement,
    AudioContextClass: h.FakeAudioContext,
    MediaStreamClass: h.FakeMediaStream
  });

  await assert.rejects(session.start(), /synchronous playback failure/);
  assert.ok(h.events.includes('pause'));
  assert.equal(h.audioElement.currentTime, 0);
  await session.cleanup();
});


test('does not start playback when cleanup happens during context resume', async () => {
  const h = createHarness();
  let resolveResume;
  class DelayedResumeContext extends h.FakeAudioContext {
    resume() {
      h.events.push('resume');
      return new Promise(resolve => {
        resolveResume = () => {
          this.state = 'running';
          resolve();
        };
      });
    }
  }
  const session = await createAudioExportSession({
    videoStream: { getTracks: () => [h.videoTrack] },
    audioElement: h.audioElement,
    AudioContextClass: DelayedResumeContext,
    MediaStreamClass: h.FakeMediaStream
  });

  const startPromise = session.start();
  await session.cleanup();
  resolveResume();

  await assert.rejects(startPromise, /already closed/);
  assert.equal(h.events.includes('play'), false);
  assert.equal(h.audioTrack.stopped, true);
});


test('allows retry after a transient audio playback failure', async () => {
  const h = createHarness();
  let attempts = 0;
  h.audioElement.play = async () => {
    attempts += 1;
    h.events.push(`play-${attempts}`);
    if (attempts === 1) throw new Error('temporary playback failure');
  };
  const session = await createAudioExportSession({
    videoStream: { getTracks: () => [h.videoTrack] },
    audioElement: h.audioElement,
    AudioContextClass: h.FakeAudioContext,
    MediaStreamClass: h.FakeMediaStream
  });

  await assert.rejects(session.start(), /temporary playback failure/);
  assert.equal(h.audioElement.currentTime, 0);
  await session.start();
  assert.equal(attempts, 2);
  assert.equal(h.events.filter(event => event === 'resume').length, 2);
  await session.cleanup();
});

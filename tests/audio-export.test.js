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


test('schedules decoded dialogue WAV tracks on the shared recording clock', async () => {
  const h = createHarness();
  const scheduled = [];
  class VoiceContext extends h.FakeAudioContext {
    currentTime = 12;
    async decodeAudioData(bytes) {
      assert.ok(bytes instanceof ArrayBuffer);
      return { duration: 0.75 };
    }
    createBufferSource() {
      return {
        buffer: null,
        connect() { h.events.push('voice-connect'); },
        start(when) { scheduled.push(when); h.events.push('voice-start'); },
        stop() { h.events.push('voice-stop'); }
      };
    }
  }
  const session = await createAudioExportSession({
    videoStream: { getTracks: () => [h.videoTrack] },
    voiceTracks: [
      { cueId: 'scene-1:line-1', blob: new Blob(['wav-a']), startMs: 0 },
      { cueId: 'scene-1:line-2', blob: new Blob(['wav-b']), startMs: 1250 }
    ],
    AudioContextClass: VoiceContext,
    MediaStreamClass: h.FakeMediaStream
  });
  assert.deepEqual(session.stream.getTracks().map(track => track.kind), ['video', 'audio']);
  const startInfo = await session.start();
  assert.equal(Number.isFinite(startInfo.scheduledStartAtMs), true);
  assert.deepEqual(scheduled, [12.08, 13.33]);
  assert.equal(h.events.filter(event => event === 'voice-start').length, 2);
  await session.cleanup();
  assert.equal(h.events.filter(event => event === 'voice-stop').length, 2);
  assert.ok(h.events.includes('close'));
});

test('rejects dialogue tracks with missing audio or invalid offsets', async () => {
  const h = createHarness();
  await assert.rejects(() => createAudioExportSession({
    videoStream: { getTracks: () => [h.videoTrack] },
    voiceTracks: [{ startMs: 0 }],
    AudioContextClass: h.FakeAudioContext,
    MediaStreamClass: h.FakeMediaStream
  }), /non-empty audio Blob/);
  await assert.rejects(() => createAudioExportSession({
    videoStream: { getTracks: () => [h.videoTrack] },
    voiceTracks: [{ blob: new Blob(['wav']), startMs: -1 }],
    AudioContextClass: h.FakeAudioContext,
    MediaStreamClass: h.FakeMediaStream
  }), /startMs must be non-negative/);
});

test('requires at least one audio source', async () => {
  const h = createHarness();
  await assert.rejects(() => createAudioExportSession({
    videoStream: { getTracks: () => [h.videoTrack] },
    AudioContextClass: h.FakeAudioContext,
    MediaStreamClass: h.FakeMediaStream
  }), /At least one music element or voice track/);
});


test('rejects invalid expected voice duration metadata', async () => {
  const h = createHarness();
  await assert.rejects(() => createAudioExportSession({
    videoStream: { getTracks: () => [h.videoTrack] },
    voiceTracks: [{ blob: new Blob(['wav']), startMs: 0, durationMs: 0 }],
    AudioContextClass: h.FakeAudioContext,
    MediaStreamClass: h.FakeMediaStream
  }), /durationMs must be a finite positive number/);
});

test('rejects decoded dialogue audio whose measured duration conflicts with timeline metadata', async () => {
  const h = createHarness();
  let closed = false;
  class MismatchedVoiceContext extends h.FakeAudioContext {
    async decodeAudioData() { return { duration: 1.5 }; }
    async close() { closed = true; await super.close(); }
  }
  await assert.rejects(() => createAudioExportSession({
    videoStream: { getTracks: () => [h.videoTrack] },
    voiceTracks: [{
      cueId: 'scene-1:line-1',
      blob: new Blob(['wav-a']),
      startMs: 0,
      durationMs: 750
    }],
    AudioContextClass: MismatchedVoiceContext,
    MediaStreamClass: h.FakeMediaStream
  }), /Decoded dialogue duration does not match timeline metadata/);
  assert.equal(closed, true);
});

test('accepts decoded dialogue audio within the measured-duration tolerance', async () => {
  const h = createHarness();
  class VoiceContext extends h.FakeAudioContext {
    async decodeAudioData() { return { duration: 0.76 }; }
  }
  const session = await createAudioExportSession({
    videoStream: { getTracks: () => [h.videoTrack] },
    voiceTracks: [{
      cueId: 'scene-1:line-1',
      blob: new Blob(['wav-a']),
      startMs: 0,
      durationMs: 750
    }],
    AudioContextClass: VoiceContext,
    MediaStreamClass: h.FakeMediaStream
  });
  await session.cleanup();
});

import test from "node:test";
import assert from "node:assert/strict";
import { createVoicePreviewSession } from "../src/audio-preview.js";

function fakeContextFactory() {
  const state = { sources: [], closed: false, resumed: false };
  class FakeAudioContext {
    constructor() { this.currentTime = 4; this.state = "running"; this.destination = {}; }
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() { state.disconnected = true; } }; }
    async decodeAudioData() { return { duration: 1, numberOfChannels: 1, sampleRate: 10, getChannelData: () => new Float32Array(10) }; }
    async resume() { state.resumed = true; }
    createBufferSource() { return { connect() {}, start(time) { state.sources.push(time); }, stop() { state.stopped = (state.stopped || 0) + 1; } }; }
    async close() { state.closed = true; this.state = "closed"; }
  }
  return { AudioContextClass: FakeAudioContext, state };
}
const voiceTrack = (startMs, cueId = "cue") => ({ cueId, startMs, durationMs: 1000, blob: new Blob(["voice"], { type: "audio/wav" }), characterId: "Foxy" });

test("decodes local dialogue and schedules all speakers against one audio clock", async () => {
  const fake = fakeContextFactory();
  const session = await createVoicePreviewSession({ voiceTracks: [voiceTrack(0, "first"), voiceTrack(450, "second")], AudioContextClass: fake.AudioContextClass, now: () => 1000 });
  assert.equal(session.decodedTracks.length, 2);
  assert.equal(await session.start(), 1080);
  assert.deepEqual(fake.state.sources, [4.08, 4.53]);
  assert.equal(fake.state.resumed, true);
  await session.cleanup();
  assert.equal(fake.state.stopped, 2);
  assert.equal(fake.state.closed, true);
});

test("rejects malformed tracks and clamps voice gain", async () => {
  const fake = fakeContextFactory();
  const session = await createVoicePreviewSession({ voiceTracks: [voiceTrack(0)], voiceVolume: 4, AudioContextClass: fake.AudioContextClass });
  assert.equal(session.decodedTracks.length, 1);
  await session.cleanup();
  await assert.rejects(() => createVoicePreviewSession({ voiceTracks: [{}], AudioContextClass: fake.AudioContextClass }), /non-empty Blob/);
  await assert.rejects(() => createVoicePreviewSession({ voiceTracks: [voiceTrack(-1)], AudioContextClass: fake.AudioContextClass }), /startMs/);
  await assert.rejects(() => createVoicePreviewSession({ voiceTracks: [], AudioContextClass: fake.AudioContextClass }), /At least one/);
});

test("closes audio context when decoding fails", async () => {
  const state = { closed: false };
  class BrokenContext {
    constructor() { this.state = "running"; this.currentTime = 0; this.destination = {}; }
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; }
    async decodeAudioData() { throw new Error("decode failed"); }
    async close() { state.closed = true; this.state = "closed"; }
  }
  await assert.rejects(() => createVoicePreviewSession({ voiceTracks: [voiceTrack(0)], AudioContextClass: BrokenContext }), /decode failed/);
  assert.equal(state.closed, true);
});

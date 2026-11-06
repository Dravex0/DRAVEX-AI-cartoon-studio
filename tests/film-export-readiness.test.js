import test from "node:test";
import assert from "node:assert/strict";
import { validateExportTracks, waitForExportVideoReady } from "../src/film-export-readiness.js";

class FakeVideo extends EventTarget {
  constructor() { super(); this.readyState = 0; this.videoWidth = 0; this.videoHeight = 0; this.error = null; }
  set src(value) { this.source = value; }
  pause() {}
  removeAttribute() {}
  load() {}
  becomeReady() {
    this.readyState = 2; this.videoWidth = 1280; this.videoHeight = 720;
    this.dispatchEvent(new Event("loadeddata"));
  }
}
const makeStream = (video = 1, audio = 0) => ({
  getVideoTracks: () => Array(video).fill({ kind: "video" }),
  getAudioTracks: () => Array(audio).fill({ kind: "audio" })
});

test("requires video and any requested audio tracks", () => {
  assert.deepEqual(validateExportTracks(makeStream(1, 1), { audioRequired: true }), { videoTracks: 1, audioTracks: 1 });
  assert.throws(() => validateExportTracks(makeStream(0, 1)), /no video track/);
  assert.throws(() => validateExportTracks(makeStream(1), { audioRequired: true }), /no audio track/);
});

test("waits for a decoded frame and valid dimensions", async () => {
  const video = new FakeVideo(); let revoked = false;
  const pending = waitForExportVideoReady(new Blob(["webm"]), {
    createVideoElement: () => video, createObjectURL: () => "blob:test",
    revokeObjectURL: () => { revoked = true; }, timeoutMs: 100
  });
  video.becomeReady();
  assert.deepEqual(await pending, { width: 1280, height: 720, readyState: 2 });
  assert.equal(revoked, true);
});

test("rejects decode errors and releases the temporary URL", async () => {
  const video = new FakeVideo(); let revoked = false;
  const pending = waitForExportVideoReady(new Blob(["bad"]), {
    createVideoElement: () => video, createObjectURL: () => "blob:test",
    revokeObjectURL: () => { revoked = true; }, timeoutMs: 100
  });
  video.error = { message: "corrupt WebM" }; video.dispatchEvent(new Event("error"));
  await assert.rejects(pending, /corrupt WebM/);
  assert.equal(revoked, true);
});

test("releases the temporary URL when video element creation fails", async () => {
  let revoked = false;
  await assert.rejects(waitForExportVideoReady(new Blob(["webm"]), {
    createVideoElement: () => { throw new Error("video element unavailable"); },
    createObjectURL: () => "blob:test",
    revokeObjectURL: () => { revoked = true; }
  }), /video element unavailable/);
  assert.equal(revoked, true);
});

test("attempts URL release even if player cleanup throws", async () => {
  const video = new FakeVideo(); let revoked = false;
  video.pause = () => { throw new Error("pause failed"); };
  const pending = waitForExportVideoReady(new Blob(["webm"]), {
    createVideoElement: () => video, createObjectURL: () => "blob:test",
    revokeObjectURL: () => { revoked = true; }, timeoutMs: 100
  });
  video.becomeReady();
  assert.deepEqual(await pending, { width: 1280, height: 720, readyState: 2 });
  assert.equal(revoked, true);
});

test("rejects empty blobs and invalid timeouts", async () => {
  await assert.rejects(waitForExportVideoReady(new Blob()), /non-empty/);
  await assert.rejects(waitForExportVideoReady(new Blob(["x"]), { timeoutMs: 0 }), /positive finite/);
});

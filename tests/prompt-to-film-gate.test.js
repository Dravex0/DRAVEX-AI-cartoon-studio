import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePromptToFilmStart } from '../src/prompt-to-film-gate.js';

const ready = {
  mode: 'huggingface',
  sceneCount: 3,
  videoProviderReady: true,
  remoteVideoConsent: true,
  missingImageCount: 3,
  imagePromptConsent: true
};

test('allows a fully configured one-click film run', () => {
  const result = evaluatePromptToFilmStart(ready);
  assert.equal(result.ok, true);
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.blockers, []);
});

test('requires an explicit Hugging Face video consent', () => {
  const result = evaluatePromptToFilmStart({ ...ready, remoteVideoConsent: false });
  assert.equal(result.ok, false);
  assert.ok(result.blockers.includes('remote-video-consent-required'));
});

test('requires a connected video provider', () => {
  const result = evaluatePromptToFilmStart({ ...ready, videoProviderReady: false });
  assert.ok(result.blockers.includes('video-provider-not-ready'));
});

test('requires separate AI Horde consent only when scene images are missing', () => {
  const missing = evaluatePromptToFilmStart({ ...ready, imagePromptConsent: false });
  assert.ok(missing.blockers.includes('image-prompt-consent-required'));
  const existing = evaluatePromptToFilmStart({ ...ready, missingImageCount: 0, imagePromptConsent: false });
  assert.equal(existing.ok, true);
});

test('local ComfyUI does not require remote Hugging Face consent', () => {
  const result = evaluatePromptToFilmStart({
    mode: 'comfyui',
    sceneCount: 2,
    videoProviderReady: true,
    remoteVideoConsent: false,
    missingImageCount: 0
  });
  assert.equal(result.ok, true);
});

test('blocks concurrent runs and missing storyboards', () => {
  assert.ok(evaluatePromptToFilmStart({ ...ready, running: true }).blockers.includes('generation-already-running'));
  assert.ok(evaluatePromptToFilmStart({ ...ready, sceneCount: 0 }).blockers.includes('storyboard-required'));
});

test('rejects unknown provider modes and normalizes negative image counts', () => {
  const result = evaluatePromptToFilmStart({ ...ready, mode: 'unknown', missingImageCount: -4 });
  assert.ok(result.blockers.includes('video-mode-invalid'));
  assert.equal(result.missingImageCount, 0);
});

test('local canvas mode needs no video provider or remote image consent', () => {
  const result = evaluatePromptToFilmStart({
    mode: 'local-canvas',
    sceneCount: 4,
    videoProviderReady: false,
    remoteVideoConsent: false,
    missingImageCount: 4,
    imagePromptConsent: false
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.blockers, []);
});

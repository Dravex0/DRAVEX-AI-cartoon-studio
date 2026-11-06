import test from 'node:test';
import assert from 'node:assert/strict';
import { createUniversalFilmCompositionCapability } from '../src/universal-film-composition-capability.js';

const plan = { sourceRequest: 'Create a complete video film' };
const step = { requiredCapabilities: ['film.compose'] };
const complete = {
  totalScenes: 2, videoScenes: 2, stillScenes: 0, complete: true,
  items: [{ id: 'scene-a', index: 0, title: 'Opening', mediaType: 'video' }, { id: 'scene-b', index: 1, title: 'Ending', mediaType: 'video' }]
};
const validArtifact = () => ({
  status: 'completed', filename: 'dravex-cartoon-film.webm',
  mimeType: 'video/webm', size: 4096, decoded: true, sceneCount: 2, durationMs: 6000
});

test('is local and available only when every scene has decoded video', () => {
  let current = complete;
  const capability = createUniversalFilmCompositionCapability({
    getSceneReport: () => current, composeFilm: async () => validArtifact()
  });
  assert.equal(capability.id, 'film.compose');
  assert.equal(capability.privacy, 'local');
  assert.equal(capability.isAvailable(), true);
  current = { ...complete, videoScenes: 1, stillScenes: 1, complete: false };
  assert.equal(capability.isAvailable(), false);
});

test('rejects composition when even one scene is still-image only', async () => {
  let called = false;
  const capability = createUniversalFilmCompositionCapability({
    getSceneReport: () => ({
      totalScenes: 2, videoScenes: 1, stillScenes: 1, complete: false,
      items: [{ index: 0, mediaType: 'video' }, { index: 1, mediaType: 'still' }]
    }),
    composeFilm: async () => { called = true; return validArtifact(); }
  });
  await assert.rejects(capability.run({ plan, step }), { code: 'FILM_VIDEO_COVERAGE_INCOMPLETE' });
  assert.equal(called, false);
});

test('requires the exact capability binding and a video request', async () => {
  const capability = createUniversalFilmCompositionCapability({
    getSceneReport: () => complete, composeFilm: async () => validArtifact()
  });
  await assert.rejects(capability.run({ plan, step: { requiredCapabilities: ['video.generate.local'] } }), {
    code: 'CAPABILITY_BINDING_MISMATCH'
  });
  await assert.rejects(capability.run({ plan: { sourceRequest: 'Make a still poster' }, step }), {
    code: 'CAPABILITY_REQUEST_MISMATCH'
  });
});

test('returns only verified local film metadata', async () => {
  const capability = createUniversalFilmCompositionCapability({
    getSceneReport: () => complete, composeFilm: async () => validArtifact()
  });
  assert.deepEqual(await capability.run({ plan, step }), {
    type: 'full-film', filename: 'dravex-cartoon-film.webm', mimeType: 'video/webm',
    size: 4096, sceneCount: 2, durationMs: 6000, decoded: true, local: true
  });
});

test('rejects a reordered scene list even when video coverage stays complete', async () => {
  let current = complete;
  const capability = createUniversalFilmCompositionCapability({
    getSceneReport: () => current,
    composeFilm: async () => {
      current = { ...complete, items: [...complete.items].reverse().map((item, index) => ({ ...item, index })) };
      return validArtifact();
    }
  });
  await assert.rejects(capability.run({ plan, step }), { code: 'FILM_SCENE_SET_CHANGED' });
});

test('rejects replacement of a scene during composition with the same scene count', async () => {
  let current = complete;
  const capability = createUniversalFilmCompositionCapability({
    getSceneReport: () => current,
    composeFilm: async () => {
      current = { ...complete, items: [complete.items[0], { ...complete.items[1], id: 'replacement-scene' }] };
      return validArtifact();
    }
  });
  await assert.rejects(capability.run({ plan, step }), { code: 'FILM_SCENE_SET_CHANGED' });
});

test('rejects an empty or non-decoded export', async () => {
  const capability = createUniversalFilmCompositionCapability({
    getSceneReport: () => complete,
    composeFilm: async () => ({
      status: 'completed', filename: 'bad.webm', mimeType: 'video/webm',
      size: 0, decoded: false, sceneCount: 2
    })
  });
  await assert.rejects(capability.run({ plan, step }), { code: 'INVALID_FILM_ARTIFACT' });
});

test('honours cancellation before composition', async () => {
  let called = false;
  const capability = createUniversalFilmCompositionCapability({
    getSceneReport: () => complete,
    composeFilm: async () => { called = true; return validArtifact(); }
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(capability.run({ plan, step, signal: controller.signal }), { name: 'AbortError' });
  assert.equal(called, false);
});

test('reports a missing scene list safely when scene coverage cannot be read', async () => {
  const capability = createUniversalFilmCompositionCapability({
    getSceneReport: () => null, composeFilm: async () => validArtifact()
  });
  assert.equal(capability.isAvailable(), false);
  await assert.rejects(capability.run({ plan, step }), { code: 'FILM_VIDEO_COVERAGE_INCOMPLETE' });
});

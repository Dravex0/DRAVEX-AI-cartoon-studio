import { describe, it, expect, vi } from 'vitest';
import { createUniversalFilmCompositionCapability } from '../src/universal-film-composition-capability.js';

const plan = { sourceRequest: 'Create a complete video film' };
const step = { requiredCapabilities: ['film.compose'] };
const complete = {
  totalScenes: 2, videoScenes: 2, stillScenes: 0, complete: true,
  items: [{ index: 0, mediaType: 'video' }, { index: 1, mediaType: 'video' }]
};

describe('universal full-film composition capability', () => {
  it('is local and available only when every scene has decoded video', () => {
    const getSceneReport = vi.fn(() => complete);
    const capability = createUniversalFilmCompositionCapability({ getSceneReport, composeFilm: vi.fn() });
    expect(capability.id).toBe('film.compose');
    expect(capability.privacy).toBe('local');
    expect(capability.isAvailable()).toBe(true);
    getSceneReport.mockReturnValue({ ...complete, videoScenes: 1, stillScenes: 1, complete: false });
    expect(capability.isAvailable()).toBe(false);
  });

  it('rejects composition when even one scene is still-image only', async () => {
    const composeFilm = vi.fn();
    const capability = createUniversalFilmCompositionCapability({
      getSceneReport: () => ({
        totalScenes: 2, videoScenes: 1, stillScenes: 1, complete: false,
        items: [{ index: 0, mediaType: 'video' }, { index: 1, mediaType: 'still' }]
      }),
      composeFilm
    });
    await expect(capability.run({ plan, step })).rejects.toMatchObject({
      code: 'FILM_VIDEO_COVERAGE_INCOMPLETE'
    });
    expect(composeFilm).not.toHaveBeenCalled();
  });

  it('requires the exact capability binding and a video request', async () => {
    const capability = createUniversalFilmCompositionCapability({
      getSceneReport: () => complete, composeFilm: vi.fn()
    });
    await expect(capability.run({ plan, step: { requiredCapabilities: ['video.generate.local'] } }))
      .rejects.toMatchObject({ code: 'CAPABILITY_BINDING_MISMATCH' });
    await expect(capability.run({ plan: { sourceRequest: 'Make a still poster' }, step }))
      .rejects.toMatchObject({ code: 'CAPABILITY_REQUEST_MISMATCH' });
  });

  it('returns only verified local film metadata', async () => {
    const composeFilm = vi.fn(async () => ({
      status: 'completed', filename: 'dravex-cartoon-film.webm',
      mimeType: 'video/webm', size: 4096, decoded: true, sceneCount: 2, durationMs: 6000
    }));
    const capability = createUniversalFilmCompositionCapability({ getSceneReport: () => complete, composeFilm });
    await expect(capability.run({ plan, step })).resolves.toEqual({
      type: 'full-film', filename: 'dravex-cartoon-film.webm', mimeType: 'video/webm',
      size: 4096, sceneCount: 2, durationMs: 6000, decoded: true, local: true
    });
  });

  it('rejects an empty or non-decoded export', async () => {
    const capability = createUniversalFilmCompositionCapability({
      getSceneReport: () => complete,
      composeFilm: async () => ({ status: 'completed', filename: 'bad.webm', mimeType: 'video/webm', size: 0, decoded: false, sceneCount: 2 })
    });
    await expect(capability.run({ plan, step })).rejects.toMatchObject({ code: 'INVALID_FILM_ARTIFACT' });
  });

  it('honours cancellation before composition and after exporter completion', async () => {
    const composeFilm = vi.fn(async () => ({
      status: 'completed', filename: 'film.webm', mimeType: 'video/webm',
      size: 100, decoded: true, sceneCount: 2
    }));
    const capability = createUniversalFilmCompositionCapability({ getSceneReport: () => complete, composeFilm });
    const controller = new AbortController();
    controller.abort();
    await expect(capability.run({ plan, step, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(composeFilm).not.toHaveBeenCalled();
  });
});

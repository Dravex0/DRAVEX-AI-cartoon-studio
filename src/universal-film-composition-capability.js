const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

function abortError() {
  const error = new Error('Full-film composition was cancelled.');
  error.name = 'AbortError';
  return error;
}

/**
 * Expose the existing, app-owned WebM film exporter as a universal capability.
 * Composition is intentionally blocked until every storyboard scene has a
 * decoded video clip; still-image fallbacks are not accepted as a finished AI film.
 */
export function createUniversalFilmCompositionCapability({
  getSceneReport = () => null,
  composeFilm
} = {}) {
  if (typeof getSceneReport !== 'function') throw new TypeError('getSceneReport must be a function.');
  if (typeof composeFilm !== 'function') throw new TypeError('composeFilm must be a function.');

  function report() {
    try { return getSceneReport(); }
    catch { return null; }
  }

  function isAvailable() {
    const value = report();
    return Boolean(value && value.totalScenes > 0 &&
      value.videoScenes === value.totalScenes && value.stillScenes === 0 && value.complete === true);
  }

  return Object.freeze({
    id: 'film.compose',
    name: 'Assemble all decoded scene videos into one WebM film',
    privacy: 'local',
    isAvailable,
    async run({ plan, step, signal, reportProgress } = {}) {
      if (signal?.aborted) throw abortError();
      if (!/(video|film|movie|clip|animation|cartoon|мульт|видео|ролик|анімац)/i.test(clean(plan?.sourceRequest, 12000))) {
        const error = new Error('Film composition only accepts explicit video or film requests.');
        error.code = 'CAPABILITY_REQUEST_MISMATCH';
        throw error;
      }
      if (!step || !Array.isArray(step.requiredCapabilities) ||
          step.requiredCapabilities.length !== 1 || step.requiredCapabilities[0] !== 'film.compose') {
        const error = new Error('Film composition requires one explicit film.compose capability.');
        error.code = 'CAPABILITY_BINDING_MISMATCH';
        throw error;
      }
      const before = report();
      if (!isAvailable()) {
        const missing = before?.items?.filter(item => item.mediaType !== 'video').map(item => item.index + 1) || [];
        const error = new Error(missing.length
          ? 'Cannot assemble a full AI film: scenes without decoded video clips: ' + missing.join(', ') + '.'
          : 'Cannot assemble a full AI film until every scene has a decoded video clip.');
        error.code = 'FILM_VIDEO_COVERAGE_INCOMPLETE';
        throw error;
      }
      reportProgress?.('Validating all ' + before.totalScenes + ' decoded scene videos');
      const result = await composeFilm({ signal, reportProgress, sceneCount: before.totalScenes });
      if (signal?.aborted) throw abortError();
      const after = report();
      if (!after || after.complete !== true || after.totalScenes !== before.totalScenes || after.videoScenes !== before.videoScenes) {
        const error = new Error('Storyboard scene media changed during full-film composition.');
        error.code = 'FILM_SCENE_SET_CHANGED';
        throw error;
      }
      if (!result || result.status !== 'completed' || !clean(result.filename, 180) ||
          !/^video\//i.test(clean(result.mimeType, 80)) || !(Number(result.size) > 0) ||
          result.decoded !== true || Number(result.sceneCount) !== before.totalScenes) {
        const error = new Error('The film exporter did not return a verified, decodable full-film artifact.');
        error.code = 'INVALID_FILM_ARTIFACT';
        throw error;
      }
      return {
        type: 'full-film',
        filename: clean(result.filename, 180),
        mimeType: clean(result.mimeType, 80),
        size: Math.floor(Number(result.size)),
        sceneCount: before.totalScenes,
        durationMs: Number.isFinite(Number(result.durationMs)) ? Math.max(0, Math.floor(Number(result.durationMs))) : null,
        decoded: true,
        local: true
      };
    }
  });
}

/**
 * Prevent asynchronous scene generation from attaching a result after the
 * user has edited that scene while a provider request was still running.
 */
export function createSceneGenerationGuard() {
  const revisions = new Map();
  const keyOf = sceneId => String(sceneId ?? '').trim();

  return {
    capture(sceneId) {
      const key = keyOf(sceneId);
      if (!key) throw new TypeError('A stable scene ID is required.');
      return Object.freeze({ sceneId: key, revision: revisions.get(key) || 0 });
    },
    invalidate(sceneId) {
      const key = keyOf(sceneId);
      if (!key) return 0;
      const next = (revisions.get(key) || 0) + 1;
      revisions.set(key, next);
      return next;
    },
    isCurrent(token) {
      if (!token || typeof token !== 'object') return false;
      const key = keyOf(token.sceneId);
      return Boolean(key) && Number.isInteger(token.revision) &&
        token.revision === (revisions.get(key) || 0);
    }
  };
}

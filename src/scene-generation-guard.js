/**
 * Prevent asynchronous scene generation from attaching a result after the
 * user has edited that scene while a provider request was running.
 *
 * The local revision invalidates in-flight work. storageRevision is a
 * time-based monotonic version so IndexedDB writes remain ordered across
 * page reloads, not just within one in-memory guard instance.
 */
export function createSceneGenerationGuard() {
  const revisions = new Map();
  const storageRevisions = new Map();
  const keyOf = sceneId => String(sceneId ?? '').trim();
  const nextStorageRevision = previous => Math.max(
    Date.now() * 1000 + Math.floor(Math.random() * 1000),
    (previous || 0) + 1
  );

  return {
    capture(sceneId) {
      const key = keyOf(sceneId);
      if (!key) throw new TypeError('A stable scene ID is required.');
      if (!storageRevisions.has(key)) storageRevisions.set(key, nextStorageRevision(0));
      return Object.freeze({
        sceneId: key,
        revision: revisions.get(key) || 0,
        storageRevision: storageRevisions.get(key)
      });
    },
    invalidate(sceneId) {
      const key = keyOf(sceneId);
      if (!key) return 0;
      const next = (revisions.get(key) || 0) + 1;
      revisions.set(key, next);
      storageRevisions.set(key, nextStorageRevision(storageRevisions.get(key) || 0));
      return next;
    },
    storageRevision(sceneId) {
      const key = keyOf(sceneId);
      if (!key) return 0;
      if (!storageRevisions.has(key)) storageRevisions.set(key, nextStorageRevision(0));
      return storageRevisions.get(key);
    },
    observeStorageRevision(sceneId, value) {
      const key = keyOf(sceneId);
      const revision = Number(value);
      if (!key || !Number.isSafeInteger(revision) || revision < 0) return 0;
      const next = Math.max(storageRevisions.get(key) || 0, revision);
      storageRevisions.set(key, next);
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

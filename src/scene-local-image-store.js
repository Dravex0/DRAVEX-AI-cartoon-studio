/**
 * Keep a manually selected local scene image bound to its stable scene ID.
 * Files remain in tab memory and are never uploaded until a provider action starts.
 */
export function createSceneLocalImageStore() {
  const images = new Map();
  const keyOf = sceneId => String(sceneId ?? "").trim();

  return Object.freeze({
    set(sceneId, image) {
      const key = keyOf(sceneId);
      if (!key) throw new TypeError("A stable scene ID is required.");
      if (image == null) {
        images.delete(key);
        return null;
      }
      if (typeof image.arrayBuffer !== "function") {
        throw new TypeError("A scene image must be a browser File or Blob.");
      }
      images.set(key, image);
      return image;
    },

    get(sceneId) {
      const key = keyOf(sceneId);
      return key ? images.get(key) || null : null;
    },

    delete(sceneId) {
      const key = keyOf(sceneId);
      return key ? images.delete(key) : false;
    },

    retain(sceneIds) {
      const keep = new Set(
        (Array.isArray(sceneIds) ? sceneIds : [])
          .map(keyOf)
          .filter(Boolean)
      );
      for (const key of images.keys()) {
        if (!keep.has(key)) images.delete(key);
      }
      return images.size;
    },

    clear() {
      images.clear();
    },

    get size() {
      return images.size;
    }
  });
}

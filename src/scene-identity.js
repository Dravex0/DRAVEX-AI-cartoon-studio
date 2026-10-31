let fallbackIdCounter = 0;

export function createSceneId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  fallbackIdCounter += 1;
  return `scene-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`;
}

/**
 * Ensures every scene has a unique, stable ID without changing valid existing IDs.
 * Mutates the supplied scene objects so IDs remain attached when scenes are deleted
 * or reordered and when drafts are saved.
 */
export function ensureSceneIds(scenes, createId = createSceneId) {
  if (!Array.isArray(scenes)) return [];
  const used = new Set();

  for (const scene of scenes) {
    if (!scene || typeof scene !== "object" || Array.isArray(scene)) continue;
    let id = typeof scene.id === "string" ? scene.id.trim() : "";
    if (!id || used.has(id)) {
      do {
        id = String(createId() || "").trim();
      } while (!id || used.has(id));
      scene.id = id;
    } else {
      scene.id = id;
    }
    used.add(id);
  }

  return scenes;
}

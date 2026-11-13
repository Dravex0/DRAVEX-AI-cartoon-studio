/**
 * Resolve the still image used by one storyboard scene.
 * A selected local ComfyUI image applies only to the currently selected scene;
 * other scenes continue to use their generated image URL or explicit AI Horde fallback.
 */
export function resolveSceneImageSource({
  mode,
  sceneIndex,
  activeSceneIndex,
  localImage,
  generatedImageUrl
} = {}) {
  if (
    mode === 'comfyui' &&
    Number.isInteger(sceneIndex) &&
    sceneIndex === activeSceneIndex &&
    localImage &&
    typeof localImage.arrayBuffer === 'function'
  ) {
    return { kind: 'blob', image: localImage };
  }
  const url = String(generatedImageUrl || '').trim();
  return url ? { kind: 'url', url } : { kind: 'missing' };
}


/**
 * Resolve a scene image source to bytes suitable for browser-side video providers.
 * Both remote providers and local ComfyUI receive a Blob for URL-backed images;
 * local Blob sources are reused without an unnecessary fetch.
 */
export async function loadSceneImageBlob(imageSource, {
  fetchImpl = fetch,
  signal
} = {}) {
  if (imageSource?.kind === 'blob') {
    const image = imageSource.image;
    if (!image || typeof image.arrayBuffer !== 'function' || !Number.isFinite(image.size) || image.size <= 0) {
      throw new Error('The selected scene image is empty.');
    }
    return image;
  }

  if (imageSource?.kind !== 'url') return null;
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchImpl must be a function.');
  }

  const response = await fetchImpl(imageSource.url, { signal });
  if (!response?.ok) {
    const status = Number.isFinite(response?.status) ? response.status : 'unknown';
    throw new Error('Cannot read the scene image (HTTP ' + status + '). Check CORS or load a local image instead.');
  }

  const image = await response.blob();
  if (!image || typeof image.arrayBuffer !== 'function' || !Number.isFinite(image.size) || image.size <= 0) {
    throw new Error('The scene image is empty.');
  }
  return image;
}

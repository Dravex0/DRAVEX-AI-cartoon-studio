/**
 * Snapshot the exact decoded scene-video elements used by a full-film export.
 * Holding element references detects replacement even when a scene keeps its ID.
 */
export function captureFilmSceneSnapshot(scenes, getVideo) {
  if (!Array.isArray(scenes)) throw new TypeError('scenes must be an array.');
  if (typeof getVideo !== 'function') throw new TypeError('getVideo must be a function.');
  return scenes.map((scene, index) => ({
    id: String(scene?.id ?? ''),
    title: String(scene?.title ?? ''),
    video: getVideo(scene, index)
  }));
}

export function matchesFilmSceneSnapshot(snapshot, scenes, getVideo, isDecoded = () => true) {
  if (!Array.isArray(snapshot) || !Array.isArray(scenes) || snapshot.length !== scenes.length ||
      typeof getVideo !== 'function' || typeof isDecoded !== 'function') return false;
  return snapshot.every((saved, index) => {
    const scene = scenes[index];
    const currentVideo = getVideo(scene, index);
    return Boolean(scene) &&
      saved.id === String(scene.id ?? '') &&
      saved.title === String(scene.title ?? '') &&
      Boolean(saved.video) &&
      currentVideo === saved.video &&
      Boolean(isDecoded(currentVideo));
  });
}

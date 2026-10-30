const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const hasAny = (text, terms) => terms.some(term => text.includes(term));

/**
 * Converts a natural-language camera direction into a bounded 2D camera move.
 * This animates a still image; it is not generative video or character animation.
 */
export function getPromptCameraTransform(motionPrompt, progress = 0) {
  const text = String(motionPrompt ?? '').toLowerCase();
  const p = clamp(Number.isFinite(Number(progress)) ? Number(progress) : 0, 0, 1);
  const eased = p * p * (3 - 2 * p);
  const staticShot = hasAny(text, ['static camera', 'locked camera', 'fixed camera', 'tripod locked', 'неподвижная камера', 'статичная камера', 'зафиксированная камера']);
  if (staticShot) return { zoom: 1.02, panX: 0, panY: 0 };

  const zoomIn = hasAny(text, ['zoom in', 'push in', 'dolly in', 'move closer', 'close-up', 'приближение', 'приближает', 'наезд камеры', 'камера приближается']);
  const zoomOut = hasAny(text, ['zoom out', 'pull back', 'dolly out', 'move away', 'отдаление', 'отъезд камеры', 'камера отдаляется']);
  const left = hasAny(text, ['pan left', 'move left', 'track left', 'слева направо', 'камера влево', 'панорама влево', 'движение влево']);
  const right = hasAny(text, ['pan right', 'move right', 'track right', 'справа налево', 'камера вправо', 'панорама вправо', 'движение вправо']);
  const up = hasAny(text, ['tilt up', 'move up', 'rise', 'crane up', 'камера вверх', 'наклон вверх', 'подъём камеры']);
  const down = hasAny(text, ['tilt down', 'move down', 'lower', 'crane down', 'камера вниз', 'наклон вниз', 'опускание камеры']);

  let zoom = 1.025 + eased * 0.045;
  if (zoomOut) zoom = 1.11 - eased * 0.075;
  else if (zoomIn) zoom = 1.025 + eased * 0.085;
  const direction = 0.58;
  const panX = (left ? 1 : right ? -1 : 0) * direction * eased;
  const panY = (up ? 1 : down ? -1 : 0) * direction * eased;
  return { zoom: clamp(zoom, 1.02, 1.12), panX: clamp(panX, -0.6, 0.6), panY: clamp(panY, -0.6, 0.6) };
}

import { getCanvasDimensions, normalizeCanvasFormat } from './canvas-format.js';

const clampIndex = value => Math.max(0, Math.floor(Number(value) || 0));

/**
 * Return normalized composition anchors for a scene.
 * Anchors are fractions of the canvas, so the same scene can be recomposed
 * for portrait and landscape without stretching its artwork.
 */
export function getSceneComposition(format = 'landscape', sceneIndex = 0) {
  const normalizedFormat = normalizeCanvasFormat(format);
  const dimensions = getCanvasDimensions(normalizedFormat);
  const index = clampIndex(sceneIndex);
  const landscapeFox = [[225, 290], [270, 300], [365, 292], [190, 295], [315, 300]];
  const landscapeStar = [440, 190];
  const portraitFox = [[180, 492], [180, 505], [180, 490], [180, 510], [180, 500]];
  const portraitStar = [180, 205];
  const fox = normalizedFormat === 'portrait'
    ? portraitFox[index % portraitFox.length]
    : landscapeFox[index % landscapeFox.length];
  const star = normalizedFormat === 'portrait' ? portraitStar : landscapeStar;
  const { logicalWidth, logicalHeight } = dimensions;

  return {
    format: normalizedFormat,
    width: logicalWidth,
    height: logicalHeight,
    star: { x: star[0] / logicalWidth, y: star[1] / logicalHeight },
    character: {
      x: fox[0] / logicalWidth,
      y: fox[1] / logicalHeight,
      scale: normalizedFormat === 'portrait' ? 0.78 : 1
    },
    ground: normalizedFormat === 'portrait'
      ? { centerX: 0.5, centerY: 0.91, radiusX: 0.9, radiusY: 0.18 }
      : { centerX: 0.5, centerY: 1.03, radiusX: 0.91, radiusY: 0.28 },
    horizonY: normalizedFormat === 'portrait' ? 0.73 : 0.86,
    title: { x: normalizedFormat === 'portrait' ? 0.06 : 0.0375, y: normalizedFormat === 'portrait' ? 0.07 : 0.105 }
  };
}

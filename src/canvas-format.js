const FORMATS = Object.freeze({
  landscape: Object.freeze({
    id: 'landscape',
    label: '16:9',
    aspectRatio: '16:9',
    width: 1280,
    height: 720,
    logicalWidth: 640,
    logicalHeight: 360,
    quality: Object.freeze({
      standard: Object.freeze({ width: 640, height: 384, steps: 20 }),
      high: Object.freeze({ width: 768, height: 448, steps: 24 }),
      ultra: Object.freeze({ width: 1024, height: 576, steps: 30 })
    })
  }),
  portrait: Object.freeze({
    id: 'portrait',
    label: '9:16',
    aspectRatio: '9:16',
    width: 720,
    height: 1280,
    logicalWidth: 360,
    logicalHeight: 640,
    quality: Object.freeze({
      standard: Object.freeze({ width: 384, height: 640, steps: 20 }),
      high: Object.freeze({ width: 448, height: 768, steps: 24 }),
      ultra: Object.freeze({ width: 576, height: 1024, steps: 30 })
    })
  })
});

export function normalizeCanvasFormat(value) {
  return value === 'portrait' || value === '9:16' ? 'portrait' : 'landscape';
}

export function getCanvasFormat(value = 'landscape') {
  return FORMATS[normalizeCanvasFormat(value)];
}

export function getCanvasDimensions(format = 'landscape') {
  const { width, height, logicalWidth, logicalHeight, aspectRatio } = getCanvasFormat(format);
  return { width, height, logicalWidth, logicalHeight, aspectRatio };
}

export function getImageGenerationDimensions(format = 'landscape', quality = 'standard') {
  const profile = getCanvasFormat(format).quality[quality] || getCanvasFormat(format).quality.standard;
  return { ...profile };
}

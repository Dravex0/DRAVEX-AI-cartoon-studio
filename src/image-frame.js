/**
 * Calculates a centered cover crop for drawing an image into a canvas viewport.
 * The optional zoom is applied around the image center; pan values are normalized
 * fractions of the viewport and clamped so callers cannot create invalid geometry.
 */
export function getImageCoverCrop(imageWidth, imageHeight, viewportWidth, viewportHeight, zoom = 1, panX = 0, panY = 0) {
  const iw = Number(imageWidth), ih = Number(imageHeight), vw = Number(viewportWidth), vh = Number(viewportHeight);
  if (![iw, ih, vw, vh].every(Number.isFinite) || iw <= 0 || ih <= 0 || vw <= 0 || vh <= 0) return null;
  const safeZoom = Math.max(1, Math.min(1.2, Number.isFinite(Number(zoom)) ? Number(zoom) : 1));
  const sourceAspect = iw / ih, targetAspect = vw / vh;
  let sw = iw, sh = ih;
  if (sourceAspect > targetAspect) sw = ih * targetAspect;
  else sh = iw / targetAspect;
  sw /= safeZoom;
  sh /= safeZoom;
  const maxX = Math.max(0, iw - sw), maxY = Math.max(0, ih - sh);
  const offsetX = Math.max(-1, Math.min(1, Number.isFinite(Number(panX)) ? Number(panX) : 0));
  const offsetY = Math.max(-1, Math.min(1, Number.isFinite(Number(panY)) ? Number(panY) : 0));
  const sx = maxX / 2 + offsetX * maxX / 2;
  const sy = maxY / 2 + offsetY * maxY / 2;
  return { sx, sy, sw, sh, dx: 0, dy: 0, dw: vw, dh: vh };
}

/** Draws an image with cover behavior; returns false when dimensions are invalid. */
export function drawImageCover(context, image, width, height, options = {}) {
  if (!context || typeof context.drawImage !== 'function' || !image) return false;
  const crop = getImageCoverCrop(image.naturalWidth || image.width, image.naturalHeight || image.height, width, height, options.zoom, options.panX, options.panY);
  if (!crop) return false;
  context.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, crop.dx, crop.dy, crop.dw, crop.dh);
  return true;
}

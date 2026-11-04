/**
 * Build a browser-local contact sheet from five sampled frames per rig body part.
 * It visualizes the exact sampled crops used by the motion audit; it does not
 * establish semantic ownership of every pixel inside a rig rectangle.
 */
const BODY_PART_ORDER = Object.freeze([
  "head", "torso", "left-arm", "right-arm", "left-leg", "right-leg"
]);

export async function createCharacterBodyPartContactSheet(entries, {
  canvasFactory = () => document.createElement("canvas"),
  labelWidth = 156,
  cellWidth = 112,
  cellHeight = 112,
  imageSize = 88,
  headerHeight = 38,
  quality = 0.88
} = {}) {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 60) {
    throw new RangeError("entries must contain between 1 and 60 body-part samples.");
  }
  if (typeof canvasFactory !== "function") throw new TypeError("canvasFactory must be a function.");
  if (![labelWidth, cellWidth, cellHeight, imageSize, headerHeight].every(Number.isInteger)
    || labelWidth < 80 || cellWidth < 64 || cellHeight < 64 || imageSize < 16
    || imageSize > Math.min(cellWidth, cellHeight) || headerHeight < 24) {
    throw new RangeError("Contact-sheet dimensions are invalid.");
  }
  if (!Number.isFinite(quality) || quality <= 0 || quality > 1) {
    throw new RangeError("quality must be greater than 0 and at most 1.");
  }

  const prepared = entries.map((entry, index) => {
    if (!entry || typeof entry.characterId !== "string" || !entry.characterId.trim()
      || !BODY_PART_ORDER.includes(entry.bodyPart) || !Array.isArray(entry.frames)
      || entry.frames.length < 2 || entry.frames.length > 5) {
      throw new TypeError("Body-part entry " + (index + 1) + " is invalid.");
    }
    const frames = entry.frames.map((frame, frameIndex) => {
      const width = Number(frame?.width), height = Number(frame?.height);
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
        || !frame?.data || frame.data.length !== width * height * 4) {
        throw new TypeError("Frame " + (frameIndex + 1) + " in entry " + (index + 1) + " is invalid.");
      }
      return frame;
    });
    return { characterId: entry.characterId, bodyPart: entry.bodyPart, frames };
  }).sort((a, b) =>
    a.characterId.localeCompare(b.characterId) ||
    BODY_PART_ORDER.indexOf(a.bodyPart) - BODY_PART_ORDER.indexOf(b.bodyPart)
  );

  const frameCount = Math.max(...prepared.map(entry => entry.frames.length));
  const canvas = canvasFactory();
  const context = canvas?.getContext?.("2d");
  if (!canvas || !context?.fillRect || !context?.fillText || !context?.drawImage) {
    throw new Error("A 2D canvas is required to create the evidence sheet.");
  }
  canvas.width = labelWidth + frameCount * cellWidth;
  canvas.height = headerHeight + prepared.length * cellHeight;
  context.fillStyle = "#101318";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.font = "12px sans-serif";
  context.textBaseline = "middle";
  context.fillText("Character / body part", 8, headerHeight / 2);
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    context.fillText("Sample " + (frameIndex + 1), labelWidth + frameIndex * cellWidth + 8, headerHeight / 2);
  }

  for (let row = 0; row < prepared.length; row += 1) {
    const entry = prepared[row];
    const y = headerHeight + row * cellHeight;
    context.fillStyle = row % 2 ? "#202630" : "#171d25";
    context.fillRect(0, y, canvas.width, cellHeight);
    context.fillStyle = "#ffffff";
    context.fillText(entry.characterId.slice(0, 18) + " / " + entry.bodyPart, 8, y + cellHeight / 2);
    for (let column = 0; column < entry.frames.length; column += 1) {
      const frame = entry.frames[column];
      const tile = canvasFactory();
      const tileContext = tile?.getContext?.("2d");
      if (!tile || !tileContext?.putImageData) {
        throw new Error("Canvas ImageData support is required to render evidence samples.");
      }
      tile.width = frame.width;
      tile.height = frame.height;
      tileContext.putImageData(frame, 0, 0);
      const x = labelWidth + column * cellWidth + Math.round((cellWidth - imageSize) / 2);
      const imageY = y + Math.round((cellHeight - imageSize) / 2);
      context.drawImage(tile, x, imageY, imageSize, imageSize);
    }
  }

  if (typeof canvas.toBlob !== "function") throw new Error("This browser cannot export a JPEG evidence sheet.");
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error("The browser could not encode the evidence sheet.")), "image/jpeg", quality);
  });
  if (!(blob instanceof Blob) || !blob.size) throw new Error("The evidence sheet export is empty.");
  return blob;
}

/**
 * Create a downloadable contact sheet from locally captured scene frame samples.
 * Images remain in the browser; this helper does not upload or persist anything.
 */
export async function createSceneFrameContactSheet(samples, {
  canvasFactory = () => document.createElement("canvas"),
  imageFactory = () => new Image(),
  labelHeight = 24,
  quality = 0.86
} = {}) {
  if (!Array.isArray(samples) || samples.length < 1 || samples.length > 5) {
    throw new RangeError("samples must contain between 1 and 5 frame samples.");
  }
  if (!Number.isInteger(labelHeight) || labelHeight < 16 || labelHeight > 64) {
    throw new RangeError("labelHeight must be an integer from 16 to 64.");
  }
  if (typeof canvasFactory !== "function" || typeof imageFactory !== "function") {
    throw new TypeError("canvasFactory and imageFactory must be functions.");
  }
  const prepared = samples.map((sample, index) => {
    if (!sample || typeof sample.dataUrl !== "string" || !sample.dataUrl.startsWith("data:image/")) {
      throw new TypeError("Frame sample " + (index + 1) + " must contain a local image data URL.");
    }
    const time = Number(sample.time);
    if (!Number.isFinite(time) || time < 0) {
      throw new TypeError("Frame sample " + (index + 1) + " must contain a valid timestamp.");
    }
    return { dataUrl: sample.dataUrl, time };
  });
  const images = await Promise.all(prepared.map(({ dataUrl }) => new Promise((resolve, reject) => {
    const image = imageFactory();
    if (!image) return reject(new Error("Could not create an image decoder."));
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("A captured frame could not be decoded for download."));
    image.src = dataUrl;
    if (image.complete && Number(image.naturalWidth || image.width) > 0) resolve(image);
  })));
  const frameWidth = Math.max(...images.map(image => Number(image.naturalWidth || image.width) || 0));
  const frameHeight = Math.max(...images.map(image => Number(image.naturalHeight || image.height) || 0));
  if (!frameWidth || !frameHeight) throw new Error("Captured frames have invalid dimensions.");
  const canvas = canvasFactory();
  const context = canvas?.getContext?.("2d");
  if (!canvas || !context || typeof context.drawImage !== "function" || typeof context.fillText !== "function") {
    throw new Error("A 2D canvas is required to create the frame sheet.");
  }
  canvas.width = frameWidth * images.length;
  canvas.height = frameHeight + labelHeight;
  context.fillStyle = "#101318";
  context.fillRect?.(0, 0, canvas.width, canvas.height);
  images.forEach((image, index) => {
    const x = index * frameWidth;
    context.drawImage(image, x, 0, frameWidth, frameHeight);
    context.fillStyle = "#ffffff";
    context.font = "12px sans-serif";
    context.textBaseline = "middle";
    context.fillText(prepared[index].time.toFixed(2) + " s", x + 6, frameHeight + labelHeight / 2);
  });
  if (typeof canvas.toBlob !== "function") {
    throw new Error("This browser cannot export the frame sheet as an image.");
  }
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error("The browser could not encode the frame sheet.")), "image/jpeg", quality);
  });
  if (!(blob instanceof Blob) || !blob.size) throw new Error("The frame sheet export is empty.");
  return blob;
}

import { test, expect } from '@playwright/test';

test('persists a real generated WebM clip and draws its decoded frame', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');

  const result = await page.evaluate(async () => {
    if (!HTMLCanvasElement.prototype.captureStream || !window.MediaRecorder) {
      throw new Error('This browser cannot record a WebM fixture for the scene-video integration test.');
    }

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = 64;
    sourceCanvas.height = 64;
    const sourceContext = sourceCanvas.getContext('2d');
    const stream = sourceCanvas.captureStream(12);
    const mimeType = ['video/webm;codecs=vp8', 'video/webm']
      .find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('No supported WebM codec is available.');

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    recorder.ondataavailable = event => {
      if (event.data?.size) chunks.push(event.data);
    };
    const stopped = new Promise(resolve => { recorder.onstop = resolve; });
    sourceContext.fillStyle = '#f02020';
    sourceContext.fillRect(0, 0, 64, 64);
    recorder.start();
    await new Promise(resolve => setTimeout(resolve, 700));
    recorder.stop();
    await stopped;
    stream.getTracks().forEach(track => track.stop());

    const generatedClip = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
    if (!generatedClip.size) throw new Error('The test video provider produced an empty clip.');

    const { createSceneVideoStorage } = await import('/src/scene-video-storage.js');
    const { getDrawableSceneVideo } = await import('/src/scene-video-render-source.js');
    const storage = createSceneVideoStorage();
    const sceneId = 'e2e-generated-clip-' + crypto.randomUUID();
    await storage.put(sceneId, generatedClip, 'generated-scene.webm');
    const restored = await storage.get(sceneId);
    if (!restored?.blob?.size) throw new Error('The generated clip was not restored from IndexedDB.');

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    const url = URL.createObjectURL(restored.blob);
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Stored generated clip did not decode a frame.')), 12_000);
        video.addEventListener('loadeddata', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
        video.addEventListener('error', () => {
          clearTimeout(timeout);
          reject(new Error('Stored generated clip could not be decoded.'));
        }, { once: true });
        video.src = url;
        video.load();
      });

      const selected = getDrawableSceneVideo(new Map([[sceneId, { video }]]), sceneId);
      if (selected !== video) throw new Error('The renderer did not select the decoded generated clip.');
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = 64;
      outputCanvas.height = 64;
      const outputContext = outputCanvas.getContext('2d');
      outputContext.drawImage(selected, 0, 0, 64, 64);
      const pixel = Array.from(outputContext.getImageData(32, 32, 1, 1).data);
      return {
        byteLength: restored.blob.size,
        mimeType: restored.blob.type,
        width: video.videoWidth,
        height: video.videoHeight,
        pixel
      };
    } finally {
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      await storage.delete(sceneId);
    }
  });

  expect(result.byteLength).toBeGreaterThan(0);
  expect(result.mimeType).toContain('video/webm');
  expect(result.width).toBeGreaterThan(0);
  expect(result.height).toBeGreaterThan(0);
  expect(result.pixel[0]).toBeGreaterThan(180);
  expect(result.pixel[1]).toBeLessThan(80);
  expect(result.pixel[2]).toBeLessThan(80);
});

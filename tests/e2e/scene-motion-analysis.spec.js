import { test, expect } from '@playwright/test';

test('analyzes color changes from a locally recorded scene video', async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto('/');

  const report = await page.evaluate(async () => {
    const { analyzeSceneVideoMotion } = await import('/src/scene-motion-analysis.js');
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    if (!context || typeof canvas.captureStream !== 'function' || typeof MediaRecorder !== 'function') {
      throw new Error('Canvas capture and MediaRecorder are required for this browser integration test.');
    }

    const mimeType = ['video/webm;codecs=vp8', 'video/webm']
      .find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('The browser cannot record a WebM test clip.');

    const paint = color => {
      context.fillStyle = color;
      context.fillRect(0, 0, canvas.width, canvas.height);
    };
    const stream = canvas.captureStream(20);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    const stopped = new Promise((resolve, reject) => {
      recorder.addEventListener('dataavailable', event => {
        if (event.data?.size) chunks.push(event.data);
      });
      recorder.addEventListener('error', event => {
        reject(event.error || new Error('Could not record the local WebM test clip.'));
      }, { once: true });
      recorder.addEventListener('stop', resolve, { once: true });
    });
    const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    let objectUrl = '';
    try {
      paint('#ff0000');
      recorder.start();
      await wait(250);
      paint('#004c00');
      await wait(250);
      paint('#ff0000');
      await wait(250);
      recorder.stop();
      await stopped;

      const clip = new Blob(chunks, { type: recorder.mimeType || mimeType });
      if (!clip.size) throw new Error('The browser recorded an empty WebM test clip.');
      objectUrl = URL.createObjectURL(clip);
      const video = document.createElement('video');
      video.muted = true;
      video.preload = 'auto';
      video.src = objectUrl;
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('The local WebM test clip did not decode.')), 8_000);
        video.addEventListener('loadeddata', () => { clearTimeout(timeout); resolve(); }, { once: true });
        video.addEventListener('error', () => {
          clearTimeout(timeout);
          reject(new Error(video.error?.message || 'The local WebM test clip could not be decoded.'));
        }, { once: true });
        video.load();
      });

      const result = await analyzeSceneVideoMotion(video, {
        sampleCount: 5,
        width: 16,
        height: 16,
        timeoutMs: 5_000
      });
      return {
        mimeType: clip.type,
        byteLength: clip.size,
        status: result.status,
        meanPixelChange: result.meanPixelChange,
        meanColorChange: result.meanColorChange,
        colorChangedPixelRatio: result.colorChangedPixelRatio
      };
    } finally {
      if (recorder.state !== 'inactive') recorder.stop();
      stream.getTracks().forEach(track => track.stop());
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  });

  expect(report.mimeType).toContain('video/webm');
  expect(report.byteLength).toBeGreaterThan(0);
  expect(report.status).toBe('visible-change');
  expect(report.meanPixelChange).toBeLessThan(0.008);
  expect(report.meanColorChange).toBeGreaterThan(0.1);
  expect(report.colorChangedPixelRatio).toBeGreaterThan(0);
});


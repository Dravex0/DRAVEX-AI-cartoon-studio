import { test, expect } from '@playwright/test';

test('includes a persisted generated scene clip in the final exported WebM', async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await page.locator('#idea').fill(
    'A small fox walks through a forest and discovers a glowing red crystal.'
  );
  await page.locator('#make').click();
  await expect(page.locator('#status')).toContainText(/storyboard created/i);
  await expect(page.locator('#scenes button.scene')).toHaveCount(5);

  // Use the application's own draft serializer so scene IDs and required
  // metadata exactly match the real export workflow.
  await page.locator('#save').click();
  const fixture = await page.evaluate(async () => {
    const draft = JSON.parse(localStorage.getItem('dravex-cartoon-draft') || 'null');
    if (!draft?.sceneMetadata?.[0]?.id) {
      throw new Error('The application did not persist a stable scene ID in its draft.');
    }
    if (!HTMLCanvasElement.prototype.captureStream || !window.MediaRecorder) {
      throw new Error('This browser cannot create the generated-video fixture.');
    }

    const source = document.createElement('canvas');
    source.width = 96;
    source.height = 96;
    const context = source.getContext('2d');
    context.fillStyle = '#ed2020';
    context.fillRect(0, 0, 96, 96);
    const stream = source.captureStream(12);
    const mimeType = ['video/webm;codecs=vp8', 'video/webm']
      .find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('No WebM recording codec is available.');

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    recorder.ondataavailable = event => {
      if (event.data?.size) chunks.push(event.data);
    };
    const stopped = new Promise(resolve => { recorder.onstop = resolve; });
    recorder.start();
    await new Promise(resolve => setTimeout(resolve, 1200));
    recorder.stop();
    await stopped;
    stream.getTracks().forEach(track => track.stop());

    const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
    if (!blob.size) throw new Error('Generated video fixture is empty.');
    const { createSceneVideoStorage } = await import('/src/scene-video-storage.js');
    const storage = createSceneVideoStorage();
    const sceneId = draft.sceneMetadata[0].id;
    await storage.put(sceneId, blob, 'generated-scene.webm');
    return { sceneId, bytes: blob.size };
  });

  expect(fixture.bytes).toBeGreaterThan(0);
  await page.reload();
  await expect(page.locator('#status')).toContainText(/restored scene videos: 1/i, { timeout: 15_000 });
  await expect(page.locator('#export')).toBeEnabled();
  await page.locator('#export').click();

  await expect.poll(async () => page.locator('#finalFilmResult').evaluate(node => !node.hidden), {
    timeout: 90_000
  }).toBe(true);

  const exportedFrame = await page.locator('#finalFilmPlayer').evaluate(async video => {
    if (!video.currentSrc.startsWith('blob:')) {
      throw new Error('Final export is not backed by a local video Blob.');
    }
    const response = await fetch(video.currentSrc);
    const blob = await response.blob();
    if (video.readyState < 2 || video.videoWidth <= 0) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Final film did not decode.')), 15_000);
        const ready = () => {
          if (video.readyState >= 2 && video.videoWidth > 0) {
            clearTimeout(timeout);
            video.removeEventListener('loadeddata', ready);
            video.removeEventListener('canplay', ready);
            resolve();
          }
        };
        video.addEventListener('loadeddata', ready);
        video.addEventListener('canplay', ready);
        ready();
      });
    }
    video.muted = true;
    await video.play();
    await new Promise(resolve => setTimeout(resolve, 350));
    video.pause();
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0);
    return {
      size: blob.size,
      type: blob.type,
      width: video.videoWidth,
      height: video.videoHeight,
      pixel: Array.from(context.getImageData(100, 100, 1, 1).data)
    };
  });

  expect(exportedFrame.size).toBeGreaterThan(0);
  expect(exportedFrame.type).toContain('video/webm');
  expect(exportedFrame.width).toBeGreaterThan(0);
  expect(exportedFrame.height).toBeGreaterThan(0);
  expect(exportedFrame.pixel[0]).toBeGreaterThan(150);
  expect(exportedFrame.pixel[1]).toBeLessThan(120);
  expect(exportedFrame.pixel[2]).toBeLessThan(120);
  expect(pageErrors, 'final export should not throw browser errors').toEqual([]);
});

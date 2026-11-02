import { test, expect } from '@playwright/test';

test('includes a persisted generated scene clip in the final exported WebM', async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');

  const fixture = await page.evaluate(async () => {
    if (!HTMLCanvasElement.prototype.captureStream || !window.MediaRecorder) {
      throw new Error('This browser cannot create the generated-video fixture.');
    }
    const source = document.createElement('canvas');
    source.width = 96;
    source.height = 96;
    const context = source.getContext('2d');
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
    context.fillStyle = '#ed2020';
    context.fillRect(0, 0, 96, 96);
    recorder.start();
    await new Promise(resolve => setTimeout(resolve, 900));
    recorder.stop();
    await stopped;
    stream.getTracks().forEach(track => track.stop());

    const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
    if (!blob.size) throw new Error('Generated video fixture is empty.');
    const { createSceneVideoStorage } = await import('/src/scene-video-storage.js');
    const storage = createSceneVideoStorage();
    const sceneId = 'e2e-final-export-generated-scene';
    await storage.put(sceneId, blob, 'generated-scene.webm');

    const draft = {
      idea: 'A generated red test scene',
      character: 'Test character',
      style: 'Storybook',
      canvasFormat: 'landscape',
      imageQuality: 'standard',
      duration: '1',
      language: 'en',
      uiLanguage: 'en',
      titles: ['Generated scene'],
      descriptions: ['A generated red scene clip.'],
      sceneMetadata: [{
        id: sceneId,
        title: 'Generated scene',
        description: 'A generated red scene clip.',
        prompt: 'A generated red scene clip.',
        visibleAction: 'A generated red scene clip.',
        durationSeconds: 1
      }],
      characterBible: [],
      sceneIndex: 0
    };
    localStorage.setItem('dravex-cartoon-draft', JSON.stringify(draft));
    return { sceneId, bytes: blob.size };
  });

  expect(fixture.bytes).toBeGreaterThan(0);
  await page.reload();
  await expect(page.locator('#export')).toBeEnabled();
  await page.locator('#export').click();
  await expect(page.locator('#finalFilmResult')).toBeVisible({ timeout: 90_000 });

  const exportedFrame = await page.locator('#finalFilmPlayer').evaluate(async video => {
    if (!video.currentSrc.startsWith('blob:')) {
      throw new Error('Final export is not backed by a local video Blob.');
    }
    if (video.readyState < 2 || video.videoWidth <= 0) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Final film did not decode.')), 15_000);
        video.addEventListener('loadeddata', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
        video.addEventListener('error', () => {
          clearTimeout(timeout);
          reject(new Error('Final film could not be decoded.'));
        }, { once: true });
      });
    }
    await video.play();
    await new Promise(resolve => setTimeout(resolve, 250));
    video.pause();
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0);
    return {
      width: video.videoWidth,
      height: video.videoHeight,
      pixel: Array.from(context.getImageData(100, 100, 1, 1).data)
    };
  });

  expect(exportedFrame.width).toBeGreaterThan(0);
  expect(exportedFrame.height).toBeGreaterThan(0);
  expect(exportedFrame.pixel[0]).toBeGreaterThan(170);
  expect(exportedFrame.pixel[1]).toBeLessThan(100);
  expect(exportedFrame.pixel[2]).toBeLessThan(100);
  expect(pageErrors, 'final export should not throw browser errors').toEqual([]);
});

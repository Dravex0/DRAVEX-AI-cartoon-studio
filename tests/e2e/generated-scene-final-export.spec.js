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

  await expect.poll(async () => {
    const resultVisible = await page.locator('#finalFilmResult').evaluate(node => !node.hidden);
    const statusText = await page.locator('#status').innerText();
    return { resultVisible, statusText };
  }, {
    timeout: 90_000,
    message: 'Final export did not complete. Inspect the application status below.'
  }).toMatchObject({ resultVisible: true });

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
  // Verify the visible download link saves the same playable WebM, not an empty placeholder.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#finalFilmDownload').click()
  ]);
  expect(download.suggestedFilename()).toBe('dravex-cartoon-film.webm');
  const downloadedPath = await download.path();
  if (!downloadedPath) throw new Error('Browser did not provide a downloaded file.');
  const { readFile } = await import('node:fs/promises');
  const downloadedBytes = await readFile(downloadedPath);
  expect(downloadedBytes.byteLength).toBeGreaterThan(1000);
  expect(Array.from(downloadedBytes.subarray(0, 4))).toEqual([0x1a, 0x45, 0xdf, 0xa3]);

  const reopened = await page.evaluate(async bytes => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Downloaded WebM could not be reopened.')), 15000);
        video.addEventListener('loadeddata', () => { clearTimeout(timeout); resolve(); }, { once: true });
        video.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Downloaded WebM decode failed.')); }, { once: true });
        video.src = url;
        video.load();
      });
      return { width: video.videoWidth, height: video.videoHeight, readyState: video.readyState };
    } finally {
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    }
  }, Array.from(downloadedBytes));
  expect(reopened.width).toBeGreaterThan(0);
  expect(reopened.height).toBeGreaterThan(0);
  expect(reopened.readyState).toBeGreaterThanOrEqual(2);
  expect(pageErrors, 'final export should not throw browser errors').toEqual([]);
});

import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('dravex-e2e-language-initialized') !== '1') {
      localStorage.setItem('dravex-ui-language', 'en');
      sessionStorage.setItem('dravex-e2e-language-initialized', '1');
    }
  });
});

function countFoxPixels(canvas) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let count = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index], green = pixels[index + 1], blue = pixels[index + 2];
    if (red > 175 && green > 65 && green < 190 && blue < 135 && red > green * 1.25) count++;
  }
  return count;
}

test('one prompt renders a visible protagonist in preview and in the downloaded moving WebM', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.locator('#idea').fill(
    'A little fox walks through a quiet forest, waves to a glowing star, and happily continues its journey.'
  );
  await page.locator('#make').click();
  await expect(page.locator('#status')).toContainText(/storyboard created/i);
  await expect(page.locator('#scenes button.scene')).toHaveCount(5);

  await page.locator('#play').click();
  await page.waitForTimeout(450);
  const previewFoxPixels = await page.locator('#canvas').evaluate(countFoxPixels);
  expect(previewFoxPixels, 'the local storyboard preview must contain the protagonist, not just the environment').toBeGreaterThan(500);

  const downloadPromise = page.waitForEvent('download', { timeout: 90_000 });
  await page.locator('#export').click();
  await expect(page.locator('#finalFilmResult')).toBeVisible({ timeout: 90_000 });
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('dravex-cartoon-film.webm');
  expect(await download.failure()).toBeNull();

  const downloadedPath = testInfo.outputPath('dravex-cartoon-film.webm');
  await download.saveAs(downloadedPath);
  const downloadedBytes = await readFile(downloadedPath);
  expect(downloadedBytes.length).toBeGreaterThan(1000);
  expect([...downloadedBytes.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);

  const evidence = await page.locator('#finalFilmPlayer').evaluate(async sourceVideo => {
    const response = await fetch(sourceVideo.currentSrc);
    if (!response.ok) throw new Error('Could not read the exported WebM Blob.');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;

    await new Promise((resolve, reject) => {
      video.addEventListener('loadeddata', resolve, { once: true });
      video.addEventListener('error', () => reject(new Error('Exported WebM could not be decoded.')), { once: true });
    });

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    const capture = () => {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const mask = new Uint8Array(canvas.width * canvas.height);
      let orangePixels = 0;
      let offset = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const red = pixels[index], green = pixels[index + 1], blue = pixels[index + 2];
        const isFoxOrange = red > 175 && green > 65 && green < 190 && blue < 135 && red > green * 1.25;
        if (isFoxOrange) { mask[offset] = 1; orangePixels++; }
        offset++;
      }
      return { mask, orangePixels };
    };

    const captureAt = target => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Exported WebM did not reach ' + target + ' seconds.')), 10_000);
      const onEnded = () => {
        clearTimeout(timeout);
        reject(new Error('Exported WebM ended before ' + target + ' seconds.'));
      };
      video.addEventListener('ended', onEnded, { once: true });
      const onFrame = (_now, metadata) => {
        if (metadata.mediaTime >= target) {
          clearTimeout(timeout);
          video.removeEventListener('ended', onEnded);
          resolve({ mediaTime: metadata.mediaTime, ...capture() });
        } else {
          video.requestVideoFrameCallback(onFrame);
        }
      };
      video.requestVideoFrameCallback(onFrame);
    });

    try {
      if (typeof video.requestVideoFrameCallback !== 'function') {
        throw new Error('This Chromium build cannot provide decoded video-frame timestamps.');
      }
      await video.play();
      const first = await captureAt(0.35);
      const second = await captureAt(1.35);
      let changedCharacterPixels = 0;
      for (let index = 0; index < first.mask.length; index++) {
        if (first.mask[index] !== second.mask[index]) changedCharacterPixels++;
      }
      return {
        width: canvas.width,
        height: canvas.height,
        duration: Number.isFinite(video.duration) ? video.duration : null,
        mediaTimes: [first.mediaTime, second.mediaTime],
        orangePixels: [first.orangePixels, second.orangePixels],
        changedCharacterPixels
      };
    } finally {
      video.pause();
      URL.revokeObjectURL(url);
      video.remove();
    }
  });

  console.log('Current-main exported WebM character evidence:', JSON.stringify(evidence));
  expect(evidence.width).toBeGreaterThan(0);
  expect(evidence.height).toBeGreaterThan(0);
  expect(evidence.orangePixels.every(count => count > 500),
    'the downloaded film must visibly contain the fox in both decoded frames: ' + JSON.stringify(evidence)).toBeTruthy();
  expect(evidence.changedCharacterPixels,
    'the character silhouette itself must change; background/camera motion alone is insufficient: ' + JSON.stringify(evidence))
    .toBeGreaterThan(100);
});

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('dravex-e2e-language-initialized') !== '1') {
      localStorage.setItem('dravex-ui-language', 'en');
      sessionStorage.setItem('dravex-e2e-language-initialized', '1');
    }
  });
});

test('exported WebM contains visible movement from the procedural fox, not only an animated background', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.locator('#idea').fill(
    'A little fox walks through a quiet forest, waves to a glowing star, and happily continues its journey.'
  );
  await page.locator('#make').click();
  await expect(page.locator('#status')).toContainText(/storyboard created/i);
  await expect(page.locator('#scenes button.scene')).toHaveCount(5);

  const downloadPromise = page.waitForEvent('download', { timeout: 90_000 });
  await page.locator('#export').click();
  await expect(page.locator('#finalFilmResult')).toBeVisible({ timeout: 90_000 });
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('dravex-cartoon-film.webm');
  expect(await download.failure()).toBeNull();

  const evidence = await page.locator('#finalFilmPlayer').evaluate(async sourceVideo => {
    const response = await fetch(sourceVideo.currentSrc);
    if (!response.ok) throw new Error('Could not read the exported WebM Blob.');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error('Exported WebM could not be decoded for frame inspection.'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const width = canvas.width;
    const height = canvas.height;
    const roi = {
      left: Math.floor(width * 0.14),
      right: Math.floor(width * 0.57),
      top: Math.floor(height * 0.43),
      bottom: Math.floor(height * 0.99)
    };

    async function capture(time) {
      video.currentTime = Math.min(time, Math.max(0, video.duration - 0.1));
      await new Promise((resolve, reject) => {
        video.onseeked = resolve;
        video.onerror = () => reject(new Error('Could not seek the exported WebM to inspect character motion.'));
      });
      context.drawImage(video, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      const mask = new Uint8Array((roi.right - roi.left) * (roi.bottom - roi.top));
      let orangePixels = 0;
      let offset = 0;
      for (let y = roi.top; y < roi.bottom; y++) {
        for (let x = roi.left; x < roi.right; x++) {
          const i = (y * width + x) * 4;
          const red = pixels[i], green = pixels[i + 1], blue = pixels[i + 2];
          const isFoxOrange = red > 175 && green > 65 && green < 190 && blue < 135 && red > green * 1.25;
          if (isFoxOrange) {
            mask[offset] = 1;
            orangePixels++;
          }
          offset++;
        }
      }
      return { mask, orangePixels };
    }

    try {
      if (video.duration < 1.6) throw new Error('Exported WebM is too short for a two-frame motion check.');
      const first = await capture(0.35);
      const second = await capture(1.35);
      let changedCharacterPixels = 0;
      for (let i = 0; i < first.mask.length; i++) {
        if (first.mask[i] !== second.mask[i]) changedCharacterPixels++;
      }
      return {
        width,
        height,
        duration: video.duration,
        orangePixels: [first.orangePixels, second.orangePixels],
        changedCharacterPixels
      };
    } finally {
      URL.revokeObjectURL(url);
      video.remove();
    }
  });

  console.log('Exported WebM character-motion evidence:', JSON.stringify(evidence));
  expect(evidence.width).toBeGreaterThan(0);
  expect(evidence.height).toBeGreaterThan(0);
  expect(evidence.orangePixels.every(count => count > 500),
    'the expected fox-colored character should be visible in both decoded WebM frames').toBeTruthy();
  expect(evidence.changedCharacterPixels, 'the character-colored silhouette should change between exported frames')
    .toBeGreaterThan(100);
});

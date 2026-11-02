import { test, expect } from '@playwright/test';

test('assembles a storyboard into a non-empty WebM container', async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await page.locator('#idea').fill(
    'A little fox discovers a glowing key in an old forest, follows its light to a hidden gate, opens it, and enters a peaceful garden.'
  );
  await page.locator('#make').click();
  await expect(page.locator('#status')).toContainText(/storyboard created/i);
  await expect(page.locator('#scenes button.scene')).toHaveCount(5);

  // This verifies the local storyboard-to-WebM assembly path. It does not
  // claim that external AI scene-video generation has run.
  await page.locator('#export').click();
  await expect(page.locator('#finalFilmResult')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('#finalFilmDownload')).toHaveAttribute(
    'download',
    'dravex-cartoon-film.webm'
  );

  const film = await page.locator('#finalFilmPlayer').evaluate(async video => {
    const source = video.currentSrc;
    if (!source.startsWith('blob:')) throw new Error('The export preview is not backed by a local Blob URL.');
    const response = await fetch(source);
    if (!response.ok) throw new Error('The exported WebM URL could not be read.');
    const blob = await response.blob();
    const signature = Array.from(new Uint8Array(await blob.slice(0, 4).arrayBuffer()));
    if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Exported WebM did not decode a playable video frame.')), 15000);
        const ready = () => {
          if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
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
    return {
      size: blob.size,
      type: blob.type,
      signature,
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      readyState: video.readyState,
      mediaError: video.error?.message || null
    };
  });

  expect(film.size).toBeGreaterThan(0);
  expect(film.type).toContain('video/webm');
  // WebM is an EBML container and starts with the four-byte EBML signature.
  expect(film.signature).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  expect(film.mediaError).toBeNull();
  expect(Number.isFinite(film.duration)).toBe(true);
  expect(film.duration).toBeGreaterThan(0);
  expect(film.width).toBeGreaterThan(0);
  expect(film.height).toBeGreaterThan(0);
  expect(film.readyState).toBeGreaterThanOrEqual(2);
  expect(pageErrors, 'export should not throw uncaught browser errors').toEqual([]);
});

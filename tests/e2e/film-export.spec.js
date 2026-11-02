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

    await new Promise((resolve, reject) => {
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return resolve();
      const timeout = setTimeout(() => reject(new Error('Exported WebM metadata did not load.')), 10_000);
      video.addEventListener('loadedmetadata', () => { clearTimeout(timeout); resolve(); }, { once: true });
      video.addEventListener('error', () => { clearTimeout(timeout); reject(new Error(video.error?.message || 'Exported WebM could not be decoded.')); }, { once: true });
    });

    video.muted = true;
    await video.play();
    let decodedFrame = false;
    if (typeof video.requestVideoFrameCallback === 'function') {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Exported WebM produced no decoded video frame.')), 5_000);
        video.requestVideoFrameCallback(() => { decodedFrame = true; clearTimeout(timeout); resolve(); });
      });
    } else {
      await new Promise(resolve => setTimeout(resolve, 300));
      decodedFrame = video.videoWidth > 0 && video.videoHeight > 0;
    }
    video.pause();

    return {
      size: blob.size,
      type: blob.type,
      signature,
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      decodedFrame,
      mediaError: video.error?.message || null
    };
  });

  expect(film.size).toBeGreaterThan(0);
  expect(film.type).toContain('video/webm');
  // WebM is an EBML container and starts with the four-byte EBML signature.
  expect(film.signature).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  expect(film.mediaError).toBeNull();
  expect(pageErrors, 'export should not throw uncaught browser errors').toEqual([]);
});

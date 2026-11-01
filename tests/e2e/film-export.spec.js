import { test, expect } from '@playwright/test';

test('assembles a storyboard into a non-empty playable WebM file', async ({ page }) => {
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
    await new Promise((resolve, reject) => {
      if (video.readyState >= 1 && Number.isFinite(video.duration)) {
        resolve();
        return;
      }
      video.addEventListener('loadedmetadata', resolve, { once: true });
      video.addEventListener('error', () => reject(new Error('The exported WebM could not be loaded.')), {
        once: true
      });
    });
    const response = await fetch(video.currentSrc);
    if (!response.ok) throw new Error('The exported WebM URL could not be read.');
    const blob = await response.blob();
    return {
      duration: video.duration,
      size: blob.size,
      type: blob.type,
      source: video.currentSrc.slice(0, 5)
    };
  });

  expect(film.source).toBe('blob:');
  expect(film.duration).toBeGreaterThan(0);
  expect(film.size).toBeGreaterThan(0);
  expect(film.type).toContain('video/webm');
  expect(pageErrors, 'export should not throw uncaught browser errors').toEqual([]);
});

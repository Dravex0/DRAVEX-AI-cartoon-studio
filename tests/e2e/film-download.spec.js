import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('dravex-e2e-language-initialized') !== '1') {
      localStorage.setItem('dravex-ui-language', 'en');
      sessionStorage.setItem('dravex-e2e-language-initialized', '1');
    }
  });
});

test('downloads the validated WebM file instead of only exposing a preview Blob URL', async ({ page }, testInfo) => {
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

  // The existing export path validates the preview Blob. This test separately
  // observes the browser download and proves the saved bytes match that Blob.
  const downloadPromise = page.waitForEvent('download', { timeout: 90_000 });
  await page.locator('#export').click();
  await expect(page.locator('#finalFilmResult')).toBeVisible({ timeout: 90_000 });

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('dravex-cartoon-film.webm');
  expect(await download.failure()).toBeNull();

  const previewDigest = await page.locator('#finalFilmPlayer').evaluate(async video => {
    if (!video.currentSrc.startsWith('blob:')) {
      throw new Error('The validated export preview is not backed by a Blob URL.');
    }
    const response = await fetch(video.currentSrc);
    if (!response.ok) throw new Error('Could not read the validated export preview Blob.');
    const bytes = await response.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  });

  const outputPath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(outputPath);
  const bytes = await readFile(outputPath);

  expect(bytes.length).toBeGreaterThan(0);
  expect([...bytes.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(previewDigest);
  expect(pageErrors, 'the download flow should not throw uncaught browser errors').toEqual([]);
});

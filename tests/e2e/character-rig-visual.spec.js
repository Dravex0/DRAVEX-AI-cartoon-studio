import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dravex-ui-language', 'en'));
});

test('renders an inspectable dance contact sheet through the real Canvas rig renderer', async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/tests/fixtures/character-rig-visual.html');
  await expect(page.locator('#status')).toContainText('READY', { timeout: 10_000 });

  const report = await page.evaluate(() => window.__rigVisualReport);
  expect(report.status).toBe('ready');
  expect(report.preset).toBe('dance');
  expect(report.partCount).toBe(10);
  expect(report.frames).toHaveLength(4);
  expect(report.quadrantHeadPixels).toHaveLength(4);
  expect(report.frames.every(frame => frame.rigDrawn === 10 && frame.rigSkipped === 0)).toBe(true);
  expect(report.minMotionDifference).toBeGreaterThan(0.002);
  expect(pageErrors, 'the visual rig diagnostic must not throw browser errors').toEqual([]);

  await page.locator('#contactSheet').screenshot({
    path: testInfo.outputPath('character-rig-dance-contact-sheet.png'),
    animations: 'disabled'
  });
});

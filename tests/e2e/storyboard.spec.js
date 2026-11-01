import { test, expect } from '@playwright/test';

test('opens the DRAVEX Cartoon Studio workspace', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page).toHaveTitle(/DRAVEX AI Cartoon Studio/i);
  await expect(page.locator('#idea')).toBeVisible();
  await expect(page.locator('#make')).toBeVisible();
  await expect(page.locator('#imageQuality')).toBeVisible();
  await expect(page.locator('#style')).toBeVisible();
  await expect(page.locator('#canvas')).toBeVisible();

  expect(pageErrors, 'the page should not throw uncaught JavaScript errors').toEqual([]);
});

test('creates a storyboard from a story prompt without remote AI services', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await page.locator('#language').selectOption('en');
  await page.locator('#idea').fill(
    'A young fox finds a glowing blue key in an old forest, follows its light to a hidden gate, opens it, and discovers a peaceful garden.'
  );
  await page.getByRole('button', { name: /start working/i }).click();

  await expect(page.locator('#status')).toContainText(/storyboard created/i);
  await expect(page.locator('#scenes button.scene').first()).toBeVisible();
  await expect(page.locator('#scenes button.scene')).toHaveCount(5);
  await expect(page.locator('#sceneTitle')).not.toHaveValue('');

  expect(pageErrors, 'storyboard creation should not throw uncaught JavaScript errors').toEqual([]);
});

import { test, expect } from '@playwright/test';

test('opens the DRAVEX Cartoon Studio workspace', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page).toHaveTitle(/DRAVEX AI Cartoon Studio/i);
  await expect(page.locator('#idea')).toBeVisible();
  await expect(page.locator('#make')).toBeVisible();
  await expect(page.locator('#imageQuality')).toBeHidden();
  await expect(page.locator('#style')).toBeVisible();
  await expect(page.locator('#language')).toBeVisible();
  await expect(page.locator('.workflow-step')).toHaveCount(3);
  await expect(page.locator('#generationTools')).not.toHaveAttribute('open', '');
  await page.getByText(/more settings/i).click();
  await expect(page.locator('#imageQuality')).toBeVisible();
  await expect(page.locator('#canvas')).toBeVisible();

  expect(pageErrors, 'the page should not throw uncaught JavaScript errors').toEqual([]);
});

test('localizes style and quality options and restores the saved creative setup', async ({ page }) => {
  await page.goto('/');
  await page.locator('#uiLanguage').selectOption('ru');
  await expect(page.locator('#make')).toHaveText('Начать работу');
  await expect(page.locator('#style option[value="3D animated"]')).toHaveText('3D-анимация');
  await expect(page.locator('#imageQuality option[value="ultra"]')).toHaveText('Максимум · 768 px');

  await page.getByText(/дополнительные настройки/i).click();
  await page.locator('#style').selectOption('3D animated');
  await page.locator('#imageQuality').selectOption('ultra');
  await page.locator('#save').click();
  await expect(page.locator('#status')).toContainText('Черновик сохранён');

  await page.reload();
  await expect(page.locator('#uiLanguage')).toHaveValue('ru');
  await expect(page.locator('#style')).toHaveValue('3D animated');
  await expect(page.locator('#imageQuality')).toHaveValue('ultra');
});

test('creates a storyboard from a story prompt without remote AI services', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await page.getByText(/more settings/i).click();
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


test('auto-detects the protagonist and plays the named-character preview without runtime errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await page.locator('#idea').fill(
    'Characters:\nArin — a 17-year-old hero with black hair and blue energy.\nScene 1: Arin walks through a quiet city square and waits beside a fountain.'
  );
  await page.getByRole('button', { name: /start working/i }).click();

  await expect(page.locator('#status')).toContainText(/storyboard created/i);
  await expect(page.locator('#character')).toHaveValue('Arin');
  await page.locator('#play').click();
  await page.waitForTimeout(180);

  expect(pageErrors, 'named-character preview playback should not throw JavaScript errors').toEqual([]);
});

test('keeps advanced AI and rigging controls out of the first-time workflow until requested', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#idea')).toBeVisible();
  await expect(page.locator('#character')).toBeVisible();
  await expect(page.locator('#style')).toBeVisible();
  await expect(page.locator('#make')).toBeVisible();
  await expect(page.locator('#checkLocalAI')).toBeHidden();
  await expect(page.locator('#generateSceneImage')).toBeHidden();
  await expect(page.locator('#generateCharacterSprites')).toBeHidden();
  await expect(page.locator('#characterMotionEditor')).not.toHaveAttribute('open', '');

  await page.locator('#generationTools > summary').click();
  await expect(page.locator('#generateSceneImage')).toBeVisible();
  await expect(page.locator('#generateCharacterSprites')).toBeVisible();
});


test('renders the detailed full-film progress dashboard without claiming generation has started', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#fullFilmProgressPanel')).toBeHidden();
  await expect(page.locator('#fullFilmPercent')).toHaveText('0%');
  await expect(page.locator('#fullFilmProgress')).toHaveAttribute('max', '100');
  await expect(page.locator('#fullFilmSceneList')).toBeEmpty();
});

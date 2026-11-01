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


test('uses a widescreen 16:9 720p canvas for preview and WebM export', async ({ page }) => {
  await page.goto('/');
  const dimensions = await page.locator('#canvas').evaluate(canvas => ({
    width: canvas.width,
    height: canvas.height
  }));
  expect(dimensions).toEqual({ width: 1280, height: 720 });
  expect(dimensions.width / dimensions.height).toBeCloseTo(16 / 9, 5);

  await page.getByText(/more settings/i).click();
  await expect(page.locator('#imageQuality option[value="standard"]')).toHaveText('Standard · 640×384');
  await expect(page.locator('#imageQuality option[value="high"]')).toHaveText('High · 768×448');
  await expect(page.locator('#imageQuality option[value="ultra"]')).toHaveText('Maximum · 1024×576');
});

test('switches to a true 9:16 portrait canvas and persists the format for WebM capture', async ({ page }) => {
  await page.goto('/');
  await page.getByText(/more settings/i).click();
  await page.locator('#canvasFormat').selectOption('portrait');

  const dimensions = await page.locator('#canvas').evaluate(canvas => ({
    width: canvas.width,
    height: canvas.height
  }));
  expect(dimensions).toEqual({ width: 720, height: 1280 });
  expect(dimensions.width / dimensions.height).toBeCloseTo(9 / 16, 5);

  const captureDimensions = await page.locator('#canvas').evaluate(canvas => {
    const stream = canvas.captureStream(24);
    const settings = stream.getVideoTracks()[0].getSettings();
    stream.getTracks().forEach(track => track.stop());
    return { width: settings.width, height: settings.height };
  });
  expect(captureDimensions).toEqual({ width: 720, height: 1280 });

  await expect(page.locator('#imageQuality option[value="standard"]')).toHaveText('Standard · 384×640');
  await expect(page.locator('#imageQuality option[value="high"]')).toHaveText('High · 448×768');
  await expect(page.locator('#imageQuality option[value="ultra"]')).toHaveText('Maximum · 576×1024');

  await page.reload();
  await expect(page.locator('#canvasFormat')).toHaveValue('portrait');
  await expect(page.locator('#canvas')).toHaveJSProperty('width', 720);
  await expect(page.locator('#canvas')).toHaveJSProperty('height', 1280);
});

test('localizes style and quality options and restores the saved creative setup', async ({ page }) => {
  await page.goto('/');
  await page.locator('#uiLanguage').selectOption('ru');
  await expect(page.locator('#make')).toHaveText('Начать работу');
  await expect(page.locator('#style option[value="3D animated"]')).toHaveText('3D-анимация');
  await expect(page.locator('#imageQuality option[value="ultra"]')).toHaveText('Максимум · 1024×576');

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

test('uploads and restores a facial image from local IndexedDB storage', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  await page.locator('#characterMotionEditor > summary').click();
  await page.locator('#characterRigEditor > summary').click();
  await page.locator('#characterFacialEditor > summary').click();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pS8AAAAASUVORK5CYII=', 'base64');
  await page.locator('#facialPartImageFile').setInputFiles({ name: 'face-base.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#facialAssetUploadStatus')).toContainText(/saved on this device/i);
  await expect(page.locator('#facialPartImageUrl')).toHaveValue(/^dravex-facial-asset:\/\//);
  await page.locator('#facialCharacterId').fill('Arin');
  await page.locator('#facialHeadBoneId').fill('head');
  await page.locator('#facialPartId').fill('face-base');
  await page.locator('#facialPartRole').selectOption('face-base');
  await page.locator('#saveFacialPart').click();
  await expect(page.locator('#facialEditorStatus')).toContainText(/part added/i);
  await page.reload();
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('dravex-cartoon-draft') || 'null'));
  expect(draft.sceneMetadata[0].characterFacialRigs[0].parts[0].imageUrl).toMatch(/^dravex-facial-asset:\/\//);
  const assetId = draft.sceneMetadata[0].characterFacialRigs[0].parts[0].imageUrl.split('//')[1];
  const restored = await page.evaluate(async id => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('dravex-cartoon-facial-assets', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise((resolve, reject) => {
      const request = db.transaction('facial-images').objectStore('facial-images').get(id);
      request.onsuccess = () => resolve({ size: request.result?.blob?.size, type: request.result?.mimeType });
      request.onerror = () => reject(request.error);
    });
  }, assetId);
  expect(restored).toEqual({ size: png.length, type: 'image/png' });
  expect(pageErrors).toEqual([]);
});

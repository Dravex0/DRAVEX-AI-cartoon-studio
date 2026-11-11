import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('dravex-e2e-language-initialized') !== '1') {
      localStorage.setItem('dravex-ui-language', 'en');
      sessionStorage.setItem('dravex-e2e-language-initialized', '1');
    }
  });
});

test('character reference image and profile survive page reload without manual save', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/DRAVEX AI Cartoon Studio/i);

  const section = page.locator('details:has(#bibleCharacterId) > summary');
  await section.click();
  await page.locator('#bibleCharacterId').fill('Mira');
  await page.locator('#bibleVisualDescription').fill('Silver-haired anime explorer with violet eyes');
  await page.locator('#bibleReferenceImageFile').setInputFiles({
    name: 'mira-reference.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p1sAAAAASUVORK5CYII=',
      'base64'
    )
  });

  await expect(page.locator('#bibleReferenceImageStatus')).toContainText(
    /saved to the draft automatically|автоматически сохранён/i
  );

  const saved = await page.evaluate(async () => {
    const draft = JSON.parse(localStorage.getItem('dravex-cartoon-draft') || 'null');
    const profile = draft?.characterBible?.find(item => item.characterId === 'Mira');
    if (!profile?.referenceImageAssetId) return null;
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('dravex-character-reference-images', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise((resolve, reject) => {
      const request = db.transaction('reference-images', 'readonly')
        .objectStore('reference-images').get(profile.referenceImageAssetId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return { assetId: profile.referenceImageAssetId, blobSize: record?.blob?.size || 0 };
  });
  expect(saved?.assetId).toBeTruthy();
  expect(saved?.blobSize).toBeGreaterThan(0);

  await page.reload();
  await page.locator('details:has(#bibleCharacterId) > summary').click();
  await expect(page.locator('#bibleCharacterId')).toHaveValue('Mira');
  await expect(page.locator('#bibleVisualDescription')).toHaveValue('Silver-haired anime explorer with violet eyes');
  const preview = page.locator('#bibleReferenceImagePreview');
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
});

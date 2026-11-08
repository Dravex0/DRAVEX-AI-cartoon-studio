import { test, expect } from '@playwright/test';

test('character reference photo survives automatic draft save and page reload', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/DRAVEX AI Cartoon Studio/i);

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

  await expect(page.locator('#bibleReferenceImageStatus')).toContainText(/automatically saved|автоматически сохранён/i);

  const savedProfile = await page.evaluate(async () => {
    const draft = JSON.parse(localStorage.getItem('dravex-cartoon-draft') || 'null');
    const profile = draft?.characterBible?.find(entry => entry.characterId === 'Mira');
    if (!profile?.referenceImageAssetId) return null;

    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('dravex-character-reference-images', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise((resolve, reject) => {
      const request = database.transaction('reference-images', 'readonly')
        .objectStore('reference-images').get(profile.referenceImageAssetId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return {
      assetId: profile.referenceImageAssetId,
      hasBlob: Boolean(record?.blob?.size),
      mimeType: record?.mimeType,
      filename: record?.filename
    };
  });

  expect(savedProfile).toMatchObject({
    hasBlob: true,
    mimeType: 'image/png',
    filename: 'mira-reference.png'
  });

  await page.reload();
  await expect(page.locator('#bibleCharacterId')).toHaveValue('Mira');
  const preview = page.locator('#bibleReferenceImagePreview');
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('#bibleVisualDescription')).toHaveValue('Silver-haired anime explorer with violet eyes');
});

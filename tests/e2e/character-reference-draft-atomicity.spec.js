import { test, expect } from '@playwright/test';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p1sAAAAASUVORK5CYII=',
  'base64'
);

async function readReferenceState(page) {
  return page.evaluate(async () => {
    const draft = JSON.parse(localStorage.getItem('dravex-cartoon-draft') || 'null');
    const profile = draft?.characterBible?.find(item => item.characterId === 'Mira');
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('dravex-character-reference-images', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const records = await new Promise((resolve, reject) => {
      const request = db.transaction('reference-images', 'readonly')
        .objectStore('reference-images').getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return {
      assetId: profile?.referenceImageAssetId || '',
      storedIds: records.map(record => record.assetId),
      storedCount: records.length
    };
  });
}

test('keeps the previous Character Bible image when draft persistence fails', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/DRAVEX AI Cartoon Studio/i);
  await page.locator('details:has(#bibleCharacterId) > summary').click();
  await page.locator('#bibleCharacterId').fill('Mira');
  await page.locator('#bibleVisualDescription').fill('Silver-haired anime explorer');

  const input = page.locator('#bibleReferenceImageFile');
  await input.setInputFiles({ name: 'mira-original.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#bibleReferenceImageStatus'))
    .toContainText(/saved to the draft automatically|автоматически сохранён/i);

  const original = await readReferenceState(page);
  expect(original.assetId).toBeTruthy();
  expect(original.storedIds).toContain(original.assetId);
  expect(original.storedCount).toBe(1);

  await page.evaluate(() => {
    const nativeSetItem = Storage.prototype.setItem;
    Object.defineProperty(window, '__dravexNativeStorageSetItem', { value: nativeSetItem });
    Storage.prototype.setItem = function (key, value) {
      if (key === 'dravex-cartoon-draft') {
        throw new DOMException('Simulated storage quota failure', 'QuotaExceededError');
      }
      return nativeSetItem.call(this, key, value);
    };
  });

  await input.setInputFiles({ name: 'mira-replacement.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#bibleReferenceImageStatus'))
    .toContainText(/previous image was kept|предыдущий референс оставлен/i);
  const afterFailedReplacement = await readReferenceState(page);
  expect(afterFailedReplacement.assetId).toBe(original.assetId);
  expect(afterFailedReplacement.storedIds).toEqual([original.assetId]);
  await expect(page.locator('#bibleReferenceImagePreview')).toBeVisible();

  await page.locator('#removeCharacterReferenceImage').click();
  await expect(page.locator('#bibleReferenceImageStatus'))
    .toContainText(/previous image was kept|предыдущий референс оставлен/i);
  const afterFailedRemoval = await readReferenceState(page);
  expect(afterFailedRemoval.assetId).toBe(original.assetId);
  expect(afterFailedRemoval.storedIds).toEqual([original.assetId]);
  await expect(page.locator('#bibleReferenceImagePreview')).toBeVisible();

  await page.evaluate(() => {
    Storage.prototype.setItem = window.__dravexNativeStorageSetItem;
  });
  await input.setInputFiles({ name: 'mira-final.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#bibleReferenceImageStatus'))
    .toContainText(/saved to the draft automatically|автоматически сохранён/i);
  const afterSuccessfulReplacement = await readReferenceState(page);
  expect(afterSuccessfulReplacement.assetId).toBeTruthy();
  expect(afterSuccessfulReplacement.assetId).not.toBe(original.assetId);
  expect(afterSuccessfulReplacement.storedIds).toEqual([afterSuccessfulReplacement.assetId]);

  await page.locator('#removeCharacterReferenceImage').click();
  await expect(page.locator('#bibleReferenceImageStatus'))
    .toContainText(/removed from the profile and the draft was saved|Фото удалено из профиля/i);
  const afterSuccessfulRemoval = await readReferenceState(page);
  expect(afterSuccessfulRemoval.assetId).toBe('');
  expect(afterSuccessfulRemoval.storedCount).toBe(0);
});

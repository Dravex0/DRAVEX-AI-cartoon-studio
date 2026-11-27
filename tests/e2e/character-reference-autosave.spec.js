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

test('preserves all Character Bible identity anchors across draft reload', async ({ page }) => {
  await page.goto('/');
  await page.locator('#language').selectOption('en');
  await page.locator('#idea').fill('Foxy is a small orange fox who finds a blue scarf.');
  await page.locator('#make').click();
  await expect(page.locator('#status')).toContainText(/storyboard created/i);
  await page.locator('#save').click();

  await page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem('dravex-cartoon-draft') || 'null');
    if (!draft) throw new Error('The draft was not saved before Character Bible restore verification.');
    draft.character = 'Foxy';
    draft.characterBible = [{
      characterId: 'Foxy',
      visualDescription: 'Small orange fox with amber eyes',
      clothing: 'Blue scarf',
      colors: 'Orange and cream',
      distinctiveFeatures: 'White tail tip',
      species: 'fox',
      ageRange: 'young adult',
      bodyShape: 'small and agile',
      hair: 'auburn',
      eyeColor: 'amber',
      silhouette: 'large ears and bushy tail',
      signatureAccessories: 'blue scarf and brass pendant'
    }];
    localStorage.setItem('dravex-cartoon-draft', JSON.stringify(draft));
  });

  await page.reload();
  await page.locator('#save').click();
  const restored = await page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem('dravex-cartoon-draft') || 'null');
    return draft?.characterBible?.find(profile => profile.characterId === 'Foxy') || null;
  });

  expect(restored).toMatchObject({
    characterId: 'Foxy',
    visualDescription: 'Small orange fox with amber eyes',
    clothing: 'Blue scarf',
    colors: 'Orange and cream',
    distinctiveFeatures: 'White tail tip',
    species: 'fox',
    ageRange: 'young adult',
    bodyShape: 'small and agile',
    hair: 'auburn',
    eyeColor: 'amber',
    silhouette: 'large ears and bushy tail',
    signatureAccessories: 'blue scarf and brass pendant'
  });
});


test('manual ComfyUI character references are cleared when switching storyboard scenes', async ({ page }) => {
  await page.goto('/');
  await page.locator('#idea').fill('Foxy walks through a forest and meets Mira.');
  await page.locator('#make').click();
  await expect(page.locator('#status')).toContainText(/storyboard created/i);
  await page.locator('details.advanced-video-settings > summary').click();
  await page.locator('#comfyPanel > summary').click();

  await page.locator('#comfyCharacterReference3').setInputFiles({
    name: 'scene-one-character.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p1sAAAAASUVORK5CYII=',
      'base64'
    )
  });
  await expect(page.locator('#comfyStatus')).toContainText(/for scene 1/i);

  await expect(page.locator('.scene').nth(1)).toBeVisible();
  await page.locator('.scene').nth(1).click();

  await expect(page.locator('#comfyCharacterReference3')).toHaveValue('');
  await expect(page.locator('#comfyStatus')).toContainText(/cleared after switching scenes/i);
});

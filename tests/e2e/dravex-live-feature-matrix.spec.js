import { test, expect } from '@playwright/test';

const LIVE_URL = 'https://dravex0.github.io/DRAVEX-AI-cartoon-studio/';

function makeSilentWav({ sampleRate = 16000, durationSeconds = 0.35 } = {}) {
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

test('DRAVEX live Pages: broad feature matrix, safe local workflows and feature inventory', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const report = {
    schemaVersion: 1,
    agent: 'DRAVEX Browser QA Agent',
    target: 'published-github-pages',
    url: LIVE_URL,
    runAt: new Date().toISOString(),
    browserProject: testInfo.project.name,
    categories: {},
    featureInventory: [],
    browserErrors: { pageErrors: [], consoleErrors: [], failedRequests: [] },
    outcome: 'running'
  };
  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', request => failedRequests.push({
    url: request.url(),
    error: request.failure()?.errorText || 'request failed'
  }));

  try {
    await page.addInitScript(() => localStorage.setItem('dravex-ui-language', 'ru'));
    await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await expect(page).toHaveTitle(/DRAVEX AI Cartoon Studio/i);

    const required = [
      'idea', 'character', 'style', 'canvasFormat', 'imageQuality', 'duration', 'language',
      'makeFilm', 'make', 'save', 'canvas', 'scenes', 'sceneMediaReport', 'play', 'export',
      'videoGenerationMode', 'audioFile', 'audioVolume', 'bibleCharacterId',
      'saveCharacterReference', 'auditAllAnimations', 'checkLocalAI',
      'characterRigJson', 'sceneDialogue', 'generateSceneImage', 'generateCharacterSprites',
      'generateCharacterRigParts', 'connectHfVideo', 'checkComfyConnection'
    ];
    for (const id of required) await expect(page.locator('#' + id), 'required feature control #' + id).toHaveCount(1);

    const inventory = await page.evaluate(() => Array.from(document.querySelectorAll('button, input, select, textarea, video, audio, canvas, details'))
      .map(element => {
        const summary = element.closest('details')?.querySelector(':scope > summary')?.textContent?.trim() || '';
        return {
          id: element.id || null,
          tag: element.tagName.toLowerCase(),
          type: element.getAttribute('type') || null,
          visible: Boolean(element.getClientRects().length),
          disabled: Boolean(element.disabled),
          expanded: element.tagName === 'DETAILS' ? element.open : undefined,
          section: summary.slice(0, 100)
        };
      }));
    report.featureInventory = inventory;
    report.categories.workspace = { status: 'passed', title: await page.title(), interactiveElements: inventory.length };

    // Interface language and creation settings.
    await page.locator('#uiLanguage').selectOption('en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.locator('#uiLanguage').selectOption('ru');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await page.locator('#style').selectOption('Anime-inspired');
    await page.locator('#duration').selectOption('5');
    await page.locator('#imageQuality').selectOption('high');
    await page.locator('#language').selectOption('uk');
    await page.locator('#language').selectOption('ru');
    await page.locator('#canvasFormat').selectOption('portrait');
    const portrait = await page.locator('#canvas').evaluate(canvas => ({ width: canvas.width, height: canvas.height }));
    expect(portrait.height).toBeGreaterThan(portrait.width);
    await page.locator('#canvasFormat').selectOption('landscape');
    const landscape = await page.locator('#canvas').evaluate(canvas => ({ width: canvas.width, height: canvas.height }));
    expect(landscape.width).toBeGreaterThan(landscape.height);
    report.categories.interfaceAndSettings = {
      status: 'passed',
      interfaceLanguages: ['en', 'ru'],
      storyLanguages: ['uk', 'ru'],
      style: 'Anime-inspired',
      durationSeconds: 5,
      imageQuality: 'high',
      portrait,
      landscape
    };

    // Create and edit a generic multi-character storyboard; no named mascot is assumed.
    await page.locator('#idea').fill(
      'A young mechanic and a small blue robot discover a broken bridge in a mountain village. They work together to repair it, then help a delivery bicycle cross safely.'
    );
    await page.locator('#make').click();
    await expect(page.locator('#status')).toContainText(/storyboard created|раскадровка создана/i, { timeout: 20_000 });
    const initialCount = await page.locator('#scenes button.scene').count();
    expect(initialCount).toBeGreaterThan(0);
    await page.locator('#scenes button.scene').first().click();
    await expect(page.locator('#sceneLabel')).toContainText(/Scene|Сцена/i);
    // The prompt-first UI intentionally hides legacy scene-edit/add/delete controls.
    // Assert that they stay hidden instead of trying to click inaccessible elements.
    for (const selector of ['#addScene', '#deleteScene', '#applyScene', '#sceneTitle', '#sceneDescription', '#sceneCharacters']) {
      await expect(page.locator(selector)).toBeHidden();
    }
    report.categories.storyboardAndSceneEditor = {
      status: 'passed',
      initialScenes: initialCount,
      sceneSelectionAccessible: true,
      legacyEditorControlsHidden: true
    };

    // Character bible, local draft persistence and local audio-file handling.
    await page.locator('details:has(#bibleCharacterId) > summary').click();
    await page.locator('#bibleCharacterId').fill('QA Mechanic');
    await page.locator('#bibleVisualDescription').fill('Young mechanic with dark curly hair, green jacket and tool belt');
    await page.locator('#bibleClothing').fill('Green work jacket and orange gloves');
    await page.locator('#bibleColors').fill('Green, orange, charcoal');
    await page.locator('#bibleDistinctiveFeatures').fill('Round protective goggles');
    await page.locator('#saveCharacterReference').click();
    await expect(page.locator('#characterReferenceStatus')).toContainText(/reference saved|образ сохранён/i);
    await page.locator('#save').click();
    await expect(page.locator('#status')).toContainText(/draft saved|черновик сохранён/i);
    await page.locator('.advanced-audio-settings').evaluate(element => { element.open = true; });
    await page.locator('#audioFile').setInputFiles({
      name: 'dravex-qa-local-audio.wav',
      mimeType: 'audio/wav',
      buffer: makeSilentWav()
    });
    await expect(page.locator('#audioStatus')).toContainText(/local only/i);
    await expect(page.locator('#audioPreview')).toBeVisible();
    await page.locator('#audioVolume').fill('42');
    await expect(page.locator('#audioVolumeValue')).toHaveText('42%');
    await page.reload();
    await page.locator('details:has(#bibleCharacterId) > summary').click();
    await expect(page.locator('#bibleCharacterId')).toHaveValue('QA Mechanic');
    await expect(page.locator('#bibleVisualDescription')).toHaveValue('Young mechanic with dark curly hair, green jacket and tool belt');
    report.categories.characterBibleDraftAndAudio = {
      status: 'passed',
      characterProfileSaved: true,
      draftRestoredAfterReload: true,
      localAudioFileAccepted: true,
      audioVolumeControl: '42%'
    };

    // Device diagnostics and the global animation/rig compatibility audit are local and safe.
    await page.locator('#checkLocalAI').click();
    await expect(page.locator('#localAIStatus')).not.toContainText(/optional check only/i, { timeout: 15_000 });
    const deviceStatus = await page.locator('#localAIStatus').innerText();
    await page.locator('#auditAllAnimations').click();
    await expect(page.locator('#animationCompatibilityStatus')).toContainText(/Scenes:|Сцен:/i, { timeout: 10_000 });
    const animationAudit = await page.locator('#animationCompatibilityStatus').innerText();
    report.categories.deviceAndAnimationDiagnostics = {
      status: 'passed',
      deviceDiagnostics: deviceStatus.slice(0, 1200),
      animationCompatibilityAudit: animationAudit.slice(0, 2400)
    };

    // External generation is inventory-only: do not send prompts, tokens or private data.
    report.categories.optionalExternalAndExperimentalFeatures = {
      status: 'inventory-only-not-invoked',
      note: 'No provider token was entered, no remote consent was granted, no external generation was triggered, and no local model was downloaded.',
      features: [
        'AI still-image generation / AI Horde',
        'character sprite generation',
        'character rig-part generation',
        'Hugging Face video provider',
        'local ComfyUI connection and video generation',
        'experimental local language model',
        'face analysis and lip-sync diagnostics'
      ]
    };

    await page.screenshot({ fullPage: true }).then(body =>
      testInfo.attach('dravex-live-feature-matrix-final.png', { body, contentType: 'image/png' })
    );
    report.browserErrors = { pageErrors, consoleErrors, failedRequests };
    report.outcome = pageErrors.length ? 'completed-with-browser-errors' : 'completed-with-findings-review';
    report.summary = {
      verifiedCategories: Object.keys(report.categories).length,
      inventoryItems: inventory.length,
      browserPageErrors: pageErrors.length,
      consoleErrors: consoleErrors.length,
      failedRequests: failedRequests.length,
      externalServicesInvoked: false,
      humanReviewStillRequired: true
    };
  } catch (error) {
    report.outcome = 'failed';
    report.failure = String(error?.stack || error?.message || error).slice(0, 6000);
    report.browserErrors = { pageErrors, consoleErrors, failedRequests };
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    await testInfo.attach('dravex-live-feature-matrix.json', {
      body: Buffer.from(JSON.stringify(report, null, 2)),
      contentType: 'application/json'
    });
  }
});

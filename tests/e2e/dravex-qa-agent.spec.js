import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.use({ video: 'on' });

test('DRAVEX Browser QA Agent: prompt → local film → downloaded and decoded WebM', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const report = {
    schemaVersion: 1,
    agent: 'DRAVEX Browser QA Agent',
    runAt: new Date().toISOString(),
    browserProject: testInfo.project.name,
    prompt: 'A small blue robot walks through a park, meets a little red bird, waves, and they become friends. Duration: 0.25 seconds.',
    steps: [],
    provider: { selectedMode: null, classification: 'not-verified-yet', externalVideoRequests: [] },
    browserErrors: [],
    outcome: 'running'
  };
  const pageErrors = [];
  const consoleErrors = [];
  const externalVideoRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('request', request => {
    try {
      const url = new URL(request.url());
      if (/(^|\\.)(huggingface\\.co|hf\\.co|aihorde\\.net|horde\\.live)$/i.test(url.hostname)) {
        externalVideoRequests.push(url.href);
      }
    } catch {}
  });

  let downloadPath = null;
  let downloadedBytes = 0;
  let downloadName = null;
  let filmEvidence = null;

  try {
    await page.goto('/');
    await expect(page).toHaveTitle(/DRAVEX AI Cartoon Studio/i);
    report.steps.push({ id: 'site-open', status: 'passed', title: await page.title() });

    const mode = await page.locator('#videoGenerationMode').inputValue();
    report.provider.selectedMode = mode;
    report.provider.classification = mode === 'local-canvas'
      ? 'local-canvas-animation-not-AI-text-to-video'
      : 'provider-mode-selected-requires-separate-provider-evidence';
    expect(mode).toBe('local-canvas');
    report.steps.push({ id: 'mode-check', status: 'passed', mode });

    await page.locator('#idea').fill(report.prompt);
    await page.screenshot({ fullPage: true }).then(body =>
      testInfo.attach('01-prompt-before-generation.png', { body, contentType: 'image/png' })
    );
    report.steps.push({ id: 'prompt-entered', status: 'passed' });

    // Listen before clicking: the app starts the download when the local export finishes.
    const downloadPromise = page.waitForEvent('download', { timeout: 150_000 });
    await page.locator('#makeFilm').click();
    report.steps.push({ id: 'create-clicked', status: 'passed' });

    await expect(page.locator('#fullFilmProgressPanel')).toBeVisible({ timeout: 20_000 });
    report.steps.push({ id: 'render-progress-visible', status: 'passed' });

    await expect(page.locator('#finalFilmResult')).toBeVisible({ timeout: 140_000 });
    await expect(page.locator('#finalFilmDownload')).toHaveAttribute('download', 'dravex-cartoon-film.webm');
    report.steps.push({ id: 'film-preview-created', status: 'passed' });

    const download = await downloadPromise;
    downloadName = download.suggestedFilename();
    downloadPath = testInfo.outputPath('dravex-qa-agent-film.webm');
    await download.saveAs(downloadPath);
    const file = await readFile(downloadPath);
    downloadedBytes = file.byteLength;
    expect(downloadName).toMatch(/\\.webm$/i);
    expect(downloadedBytes).toBeGreaterThan(1024);
    expect([...file.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
    report.steps.push({ id: 'webm-downloaded', status: 'passed', filename: downloadName, bytes: downloadedBytes, ebmlSignature: true });

    filmEvidence = await page.locator('#finalFilmPlayer').evaluate(async video => {
      if (!video.currentSrc.startsWith('blob:')) throw new Error('Preview is not backed by the exported local Blob.');
      if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('WebM metadata did not load.')), 10_000);
          video.addEventListener('loadedmetadata', () => { clearTimeout(timer); resolve(); }, { once: true });
          video.addEventListener('error', () => { clearTimeout(timer); reject(new Error(video.error?.message || 'WebM decode failed.')); }, { once: true });
        });
      }
      video.muted = true;
      await video.play();
      let decodedFrame = false;
      if (typeof video.requestVideoFrameCallback === 'function') {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('No decoded video frame arrived.')), 8_000);
          video.requestVideoFrameCallback(() => { decodedFrame = true; clearTimeout(timer); resolve(); });
        });
      } else {
        await new Promise(resolve => setTimeout(resolve, 350));
        decodedFrame = video.videoWidth > 0 && video.videoHeight > 0;
      }
      const evidence = {
        durationSeconds: Number.isFinite(video.duration) ? video.duration : null,
        width: video.videoWidth,
        height: video.videoHeight,
        readyState: video.readyState,
        decodedFrame,
        mediaError: video.error?.message || null
      };
      video.pause();
      return evidence;
    });
    expect(filmEvidence.width).toBeGreaterThan(0);
    expect(filmEvidence.height).toBeGreaterThan(0);
    expect(filmEvidence.readyState).toBeGreaterThanOrEqual(2);
    expect(filmEvidence.decodedFrame).toBe(true);
    expect(filmEvidence.mediaError).toBeNull();
    report.steps.push({ id: 'webm-playback-decoded', status: 'passed', ...filmEvidence });

    await page.screenshot({ fullPage: true }).then(body =>
      testInfo.attach('02-completed-film-preview.png', { body, contentType: 'image/png' })
    );
    await testInfo.attach('downloaded-film.webm', { path: downloadPath, contentType: 'video/webm' });

    report.provider.externalVideoRequests = externalVideoRequests;
    report.provider.classification = mode === 'local-canvas' && externalVideoRequests.length === 0
      ? 'local-canvas-only-no-external-AI-video-provider-was-run'
      : 'external-provider-activity-observed-review-required';
    expect(externalVideoRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
    report.outcome = 'passed';
    report.browserErrors = { pageErrors, consoleErrors };
  } catch (error) {
    report.outcome = 'failed';
    report.failure = String(error?.stack || error?.message || error).slice(0, 6000);
    report.browserErrors = { pageErrors, consoleErrors };
    throw error;
  } finally {
    report.provider.externalVideoRequests = externalVideoRequests;
    report.download = { filename: downloadName, bytes: downloadedBytes, saved: Boolean(downloadPath) };
    report.film = filmEvidence;
    report.finishedAt = new Date().toISOString();
    await testInfo.attach('dravex-qa-agent-report.json', {
      body: Buffer.from(JSON.stringify(report, null, 2)),
      contentType: 'application/json'
    });
    if (pageErrors.length || consoleErrors.length) {
      await testInfo.attach('browser-errors.json', {
        body: Buffer.from(JSON.stringify({ pageErrors, consoleErrors }, null, 2)),
        contentType: 'application/json'
      });
    }
  }
});

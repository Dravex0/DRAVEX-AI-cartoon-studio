import { test, expect } from '@playwright/test';

const DEPLOYED_URL = 'https://dravex0.github.io/DRAVEX-AI-cartoon-studio/';

test('DRAVEX Browser QA Agent: inspect the published GitHub Pages site', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const pageErrors = [];
  const failedAppRequests = [];
  const consoleErrors = [];

  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', request => {
    const url = request.url();
    if (url.includes('dravex0.github.io/DRAVEX-AI-cartoon-studio')) {
      failedAppRequests.push({ url, error: request.failure()?.errorText || 'request failed' });
    }
  });

  const response = await page.goto(DEPLOYED_URL, { waitUntil: 'networkidle', timeout: 45_000 });
  expect(response, 'GitHub Pages should return a document response').not.toBeNull();
  expect(response.status(), 'published site HTTP status').toBeLessThan(400);
  await expect(page).toHaveTitle(/DRAVEX AI Cartoon Studio/i);

  const controls = {
    prompt: page.locator('#idea'),
    createFilm: page.locator('#makeFilm'),
    characterReferenceUpload: page.locator('#bibleReferenceImageFile'),
    videoMode: page.locator('#videoGenerationMode'),
    previewCanvas: page.locator('#canvas'),
    downloadControl: page.locator('#finalFilmDownload')
  };

  const controlReport = {};
  for (const [name, locator] of Object.entries(controls)) {
    controlReport[name] = await locator.count();
  }
  expect(controlReport.prompt, 'prompt input exists').toBe(1);
  expect(controlReport.createFilm, 'create-film control exists').toBe(1);
  expect(controlReport.characterReferenceUpload, 'character reference upload exists').toBe(1);
  expect(controlReport.videoMode, 'video mode selector exists').toBe(1);
  expect(controlReport.previewCanvas, 'preview canvas exists').toBe(1);
  expect(controlReport.downloadControl, 'final download control exists').toBe(1);

  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    pageHeight: document.documentElement.scrollHeight,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2
  }));

  const report = {
    agent: 'DRAVEX Browser QA Agent',
    classification: 'published-site-read-only-smoke-test-no-video-generation',
    url: DEPLOYED_URL,
    checkedAt: new Date().toISOString(),
    browserProject: testInfo.project.name,
    httpStatus: response.status(),
    title: await page.title(),
    controls: controlReport,
    layout,
    pageErrors,
    consoleErrors,
    failedAppRequests
  };

  await testInfo.attach('dravex-published-site-report.json', {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: 'application/json'
  });
  await page.screenshot({ fullPage: true }).then(body =>
    testInfo.attach('dravex-published-site.png', { body, contentType: 'image/png' })
  );

  expect(pageErrors, 'no uncaught JavaScript errors on the published page').toEqual([]);
  expect(failedAppRequests, 'published app assets should load').toEqual([]);
});

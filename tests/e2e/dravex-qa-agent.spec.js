import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('dravex-e2e-language-initialized') !== '1') {
      localStorage.setItem('dravex-ui-language', 'en');
      sessionStorage.setItem('dravex-e2e-language-initialized', '1');
    }
  });
});
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
      if (/(^|\.)(huggingface\.co|hf\.co|aihorde\.net|horde\.live)$/i.test(url.hostname)) {
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
    expect(downloadName).toMatch(/\.webm$/i);
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


test('DRAVEX AI video pipeline: storyboard → mocked Wan 2.2 clips → decoded final WebM', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  let hordeSubmissions = 0;
  const hordePrompts = [];
  const mockGradioModule = [
    'let callId = 0;',
    'export function handle_file(value) { return { __dravexFile: value }; }',
    'export class Client {',
    '  static async connect(spaceId, options) { window.__dravexMockSpace = { spaceId, tokenProvided: Boolean(options && options.token) }; return new Client(); }',
    '  async view_api() { return { named_endpoints: { "/generate_video": {} } }; }',
    '  submit(endpoint, args) {',
    '    const id = ++callId;',
    '    window.__dravexWanCalls = (window.__dravexWanCalls || []).concat([{ endpoint, image: args[0] && args[0].__dravexFile, prompt: args[1], steps: args[2], duration: args[4] }]);',
    '    return { event_id: "mock-wan-" + id, cancel() {}, async *[Symbol.asyncIterator]() {',
    '      yield { type: "status", stage: "pending", position: 0, eta: 1 };',
    '      yield { type: "status", stage: "generating", progress_data: [{ progress: 1 }] };',
    '      yield { type: "data", data: [{ url: "https://files.example.test/scene.webm" }, 42] };',
    '    } };',
    '  }',
    '}'
  ].join('\n');

  await page.goto('/');
  await expect(page).toHaveTitle(/DRAVEX AI Cartoon Studio/i);

  // Create real browser-decodable media fixtures. The provider response itself is mocked;
  // this test validates the app's integration and export, not the model's visual quality.
  const fixtures = await page.evaluate(async () => {
    const imageCanvas = document.createElement('canvas');
    imageCanvas.width = 64;
    imageCanvas.height = 64;
    const imageContext = imageCanvas.getContext('2d');
    imageContext.fillStyle = '#4777aa';
    imageContext.fillRect(0, 0, 64, 64);
    imageContext.fillStyle = '#f5d36b';
    imageContext.beginPath();
    imageContext.arc(32, 32, 18, 0, Math.PI * 2);
    imageContext.fill();
    const imageBase64 = imageCanvas.toDataURL('image/png').split(',')[1];

    if (!window.MediaRecorder || typeof imageCanvas.captureStream !== 'function') {
      throw new Error('This browser cannot create the WebM fixture required by the AI-provider integration test.');
    }
    const videoCanvas = document.createElement('canvas');
    videoCanvas.width = 160;
    videoCanvas.height = 90;
    const context = videoCanvas.getContext('2d');
    const stream = videoCanvas.captureStream(16);
    const mimeType = ['video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('No supported WebM MediaRecorder format is available.');
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    recorder.addEventListener('dataavailable', event => { if (event.data && event.data.size) chunks.push(event.data); });
    const stopped = new Promise(resolve => recorder.addEventListener('stop', resolve, { once: true }));
    recorder.start();
    for (let frame = 0; frame < 14; frame += 1) {
      context.fillStyle = 'hsl(' + (frame * 23) + ', 65%, 45%)';
      context.fillRect(0, 0, 160, 90);
      context.fillStyle = '#ffffff';
      context.fillRect(frame * 9, 35, 18, 18);
      await new Promise(resolve => setTimeout(resolve, 55));
    }
    recorder.stop();
    await stopped;
    stream.getTracks().forEach(track => track.stop());
    const videoBlob = new Blob(chunks, { type: 'video/webm' });
    const bytes = new Uint8Array(await videoBlob.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return { imageBase64, videoBase64: btoa(binary), videoBytes: videoBlob.size, videoType: videoBlob.type };
  });
  expect(fixtures.videoBytes).toBeGreaterThan(1024);

  await page.route('https://cdn.jsdelivr.net/npm/@gradio/client@2.7.2/dist/index.min.js', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*' },
      body: mockGradioModule
    })
  );
  await page.route('https://aihorde.net/api/v2/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (request.method() === 'POST' && url.pathname.endsWith('/generate/async')) {
      const payload = request.postDataJSON();
      hordePrompts.push(String(payload?.prompt || ''));
      hordeSubmissions += 1;
      return route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify({ id: 'mock-horde-' + hordeSubmissions }) });
    }
    if (request.method() === 'GET' && url.pathname.includes('/generate/check/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify({ done: true, is_possible: true, queue_position: 0, waiting: 0, processing: 0 }) });
    }
    if (request.method() === 'GET' && url.pathname.includes('/generate/status/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify({ shared: true, generations: [{ img: 'https://images.example.test/scene.png', seed: '42', model: 'mock-image-model', worker_name: 'mock-worker' }] }) });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', headers, body: JSON.stringify({ message: 'Unexpected AI Horde test request: ' + request.method() + ' ' + url.pathname }) });
  });
  await page.route('https://images.example.test/scene.png', route =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: { 'access-control-allow-origin': '*' },
      body: Buffer.from(fixtures.imageBase64, 'base64')
    })
  );
  await page.route('https://files.example.test/scene.webm', route =>
    route.fulfill({
      status: 200,
      contentType: 'video/webm',
      headers: { 'access-control-allow-origin': '*' },
      body: Buffer.from(fixtures.videoBase64, 'base64')
    })
  );

  await page.locator('#idea').fill('A small blue robot walks through a park, meets a little red bird, waves, and they become friends. Make a short animated film.');
  await page.locator('.advanced-video-settings').evaluate(element => { element.open = true; });
  await page.locator('#videoGenerationMode').selectOption('huggingface');
  await page.locator('#hfVideoPanel').evaluate(element => { element.open = true; });
  await page.locator('#hfVideoToken').fill('hf_mocktoken1234567890');
  await page.locator('#hfVideoConsent').check();
  await page.locator('#hordeConsent').evaluate(element => { const details = element.closest('details'); if (details) details.open = true; });
  await page.locator('#hordeConsent').check();

  await page.locator('#connectHfVideo').click();
  await expect(page.locator('#hfVideoStatus')).toContainText('Подключено');
  await expect(page.locator('#generateFullFilmComfy')).toBeEnabled();

  const downloadPromise = page.waitForEvent('download', { timeout: 160_000 });
  await page.locator('#makeFilm').click();
  await expect(page.locator('#fullFilmProgressPanel')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#finalFilmResult')).toBeVisible({ timeout: 150_000 });
  const download = await downloadPromise;
  const downloadPath = testInfo.outputPath('dravex-mocked-ai-pipeline.webm');
  await download.saveAs(downloadPath);
  const downloaded = await readFile(downloadPath);
  expect(download.suggestedFilename()).toMatch(/\.webm$/i);
  expect(downloaded.byteLength).toBeGreaterThan(1024);
  expect([...downloaded.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);

  const providerEvidence = await page.evaluate(() => ({
    wanCalls: window.__dravexWanCalls || [],
    previewSource: document.querySelector('#finalFilmPlayer')?.currentSrc || '',
    sceneReport: document.querySelector('#sceneMediaReport')?.textContent || ''
  }));
  expect(hordeSubmissions).toBeGreaterThan(0);
  expect(hordePrompts.every(prompt => prompt.length > 0)).toBe(true);
  expect(providerEvidence.wanCalls.length).toBeGreaterThan(0);
  expect(providerEvidence.wanCalls.length).toBe(hordeSubmissions);
  expect(providerEvidence.wanCalls.every(call => call.endpoint === '/generate_video' && call.steps === 4 && String(call.prompt).length > 0)).toBe(true);
  expect(providerEvidence.previewSource.startsWith('blob:')).toBe(true);
  expect(providerEvidence.sceneReport).toMatch(/Generated video scenes:\s*5\/5/);

  const playback = await page.locator('#finalFilmPlayer').evaluate(async video => {
    if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Final WebM metadata did not load.')), 10_000);
        video.addEventListener('loadedmetadata', () => { clearTimeout(timer); resolve(); }, { once: true });
        video.addEventListener('error', () => { clearTimeout(timer); reject(new Error(video.error?.message || 'Final WebM decode failed.')); }, { once: true });
      });
    }
    video.muted = true;
    await video.play();
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('No decoded final WebM frame arrived.')), 8_000);
      if (typeof video.requestVideoFrameCallback === 'function') {
        video.requestVideoFrameCallback(() => { clearTimeout(timer); resolve(); });
      } else {
        setTimeout(() => { clearTimeout(timer); resolve(); }, 350);
      }
    });
    const result = { width: video.videoWidth, height: video.videoHeight, duration: video.duration, readyState: video.readyState };
    video.pause();
    return result;
  });
  expect(playback.width).toBeGreaterThan(0);
  expect(playback.height).toBeGreaterThan(0);
  expect(playback.readyState).toBeGreaterThanOrEqual(2);

  await testInfo.attach('mocked-ai-video-pipeline-report.json', {
    body: Buffer.from(JSON.stringify({
      classification: 'mocked-provider-integration-only-not-real-AI-generation',
      browserProject: testInfo.project.name,
      hordeImageRequests: hordeSubmissions,
      wanVideoRequests: providerEvidence.wanCalls.length,
      providerMode: 'huggingface',
      sceneReport: providerEvidence.sceneReport,
      finalFilm: playback,
      downloadedBytes: downloaded.byteLength,
      webmSignature: [...downloaded.subarray(0, 4)]
    }, null, 2)),
    contentType: 'application/json'
  });
});

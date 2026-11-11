import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const LIVE_URL = 'https://dravex0.github.io/DRAVEX-AI-cartoon-studio/';
const FOXY_PROMPT = [
  'Создай короткий мультфильм на 10–15 секунд.',
  'Главный персонаж — Foxy, маленький оранжевый лис с большими выразительными глазами.',
  'Одна непрерывная сцена: Foxy стоит на лесной тропинке, замечает красный мяч у дерева, подбегает к нему, толкает лапой, мяч катится, Foxy радостно подпрыгивает.',
  'Персонаж и мяч должны быть хорошо видны и заметно двигаться между кадрами. Не заменяй персонажа пустым фоном.',
  'Добавь русскую реплику: «Вот это находка!»'
].join(' ');

test.use({ video: 'on' });

test('DRAVEX live Pages QA: Foxy prompt → real published output evidence', async ({ page }, testInfo) => {
  test.setTimeout(210_000);
  const report = {
    schemaVersion: 2,
    agent: 'DRAVEX Browser QA Agent',
    target: 'published-github-pages',
    url: LIVE_URL,
    runAt: new Date().toISOString(),
    browserProject: testInfo.project.name,
    prompt: FOXY_PROMPT,
    checks: {},
    frames: [],
    browserErrors: [],
    classification: 'running',
    outcome: 'running'
  };
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  let downloadPath = null;
  try {
    await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await expect(page).toHaveTitle(/DRAVEX AI Cartoon Studio/i);
    report.checks.liveSite = { status: 'passed', title: await page.title(), finalUrl: page.url() };

    const mode = await page.locator('#videoGenerationMode').inputValue();
    report.checks.videoMode = {
      mode,
      classification: mode === 'local-canvas'
        ? 'local-canvas-export-not-AI-text-to-video'
        : 'provider-mode-selected-check-provider-evidence-separately'
    };
    // This public smoke test must not enter tokens or grant remote-provider consent.
    expect(mode).toBe('local-canvas');

    await page.locator('#idea').fill(FOXY_PROMPT);
    await page.screenshot({ fullPage: true }).then(body =>
      testInfo.attach('live-01-foxy-prompt.png', { body, contentType: 'image/png' })
    );

    const downloadPromise = page.waitForEvent('download', { timeout: 170_000 });
    await page.locator('#makeFilm').click();
    await expect(page.locator('#fullFilmProgressPanel')).toBeVisible({ timeout: 25_000 });
    await expect(page.locator('#finalFilmResult')).toBeVisible({ timeout: 155_000 });

    const download = await downloadPromise;
    downloadPath = testInfo.outputPath('dravex-live-pages-foxy.webm');
    await download.saveAs(downloadPath);
    const bytes = await readFile(downloadPath);
    expect(download.suggestedFilename()).toMatch(/\.webm$/i);
    expect(bytes.byteLength).toBeGreaterThan(1024);
    expect([...bytes.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
    report.checks.download = { status: 'passed', filename: download.suggestedFilename(), bytes: bytes.byteLength, ebml: true };

    const player = page.locator('#finalFilmPlayer');
    const browserEvidence = await player.evaluate(async video => {
      if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('WebM metadata timeout')), 12_000);
          video.addEventListener('loadedmetadata', () => { clearTimeout(timer); resolve(); }, { once: true });
          video.addEventListener('error', () => { clearTimeout(timer); reject(new Error(video.error?.message || 'WebM decode error')); }, { once: true });
        });
      }
      video.muted = true;
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      const sampleTimes = [...new Set([0.5, duration * 0.25, duration * 0.5, duration * 0.75, Math.max(0.5, duration - 0.5)]
        .map(value => Math.max(0, Math.min(value, Math.max(0, duration - 0.05)))))];
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(width, 320);
      canvas.height = Math.max(1, Math.round(canvas.width * height / width));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const frames = [];
      for (const time of sampleTimes) {
        video.currentTime = time;
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Video seek timeout at ' + time)), 8_000);
          const done = () => { clearTimeout(timer); resolve(); };
          if (typeof video.requestVideoFrameCallback === 'function') video.requestVideoFrameCallback(done);
          else video.addEventListener('seeked', done, { once: true });
        });
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let orange = 0;
        let nonDark = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
          if (r > 135 && g > 45 && g < 190 && b < 100 && r > g * 1.25) orange += 1;
          if (r + g + b > 75) nonDark += 1;
        }
        frames.push({
          timeSeconds: Number(time.toFixed(2)),
          pngDataUrl: canvas.toDataURL('image/png'),
          orangePixelRatio: Number((orange / (pixels.length / 4)).toFixed(5)),
          visiblePixelRatio: Number((nonDark / (pixels.length / 4)).toFixed(5))
        });
      }
      const framePixels = frames.map(frame => {
        const image = new Image();
        image.src = frame.pngDataUrl;
        return frame.pngDataUrl;
      });
      video.pause();
      return { durationSeconds: Number(duration.toFixed(2)), width, height, readyState: video.readyState, frames };
    });
    expect(browserEvidence.width).toBeGreaterThan(0);
    expect(browserEvidence.height).toBeGreaterThan(0);
    expect(browserEvidence.durationSeconds).toBeGreaterThan(1);
    report.checks.browserPlayback = {
      status: 'passed',
      durationSeconds: browserEvidence.durationSeconds,
      width: browserEvidence.width,
      height: browserEvidence.height,
      decodedFrames: browserEvidence.frames.length
    };

    const frameFiles = [];
    for (let index = 0; index < browserEvidence.frames.length; index += 1) {
      const frame = browserEvidence.frames[index];
      const base64 = frame.pngDataUrl.split(',')[1];
      const filePath = testInfo.outputPath('live-frame-' + index + '.png');
      await import('node:fs/promises').then(fs => fs.writeFile(filePath, Buffer.from(base64, 'base64')));
      frameFiles.push(filePath);
      report.frames.push({
        timeSeconds: frame.timeSeconds,
        orangePixelRatio: frame.orangePixelRatio,
        visiblePixelRatio: frame.visiblePixelRatio
      });
      await testInfo.attach('live-frame-' + index + '.png', { path: filePath, contentType: 'image/png' });
    }

    const orangeSignal = Math.max(...browserEvidence.frames.map(frame => frame.orangePixelRatio));
    const frameChange = { changedPixelRatio: browserEvidence.changedPixelRatio };\n    report.checks.visualEvidence = {
      changedPixelRatio: frameChange.changedPixelRatio,
      orangePixelSignal: orangeSignal,
      motionSignal: frameChange.changedPixelRatio >= 0.01 ? 'pixel-changes-detected' : 'no-significant-motion-detected',
      characterSignal: orangeSignal >= 0.002 ? 'orange-color-signal-detected-manual-review-required' : 'no-clear-orange-character-signal',
      semanticCharacterRecognition: 'not-automated-review-attached-frames'
    };

    const ffprobe = JSON.parse(execFileSync('ffprobe', [
      '-v', 'error', '-show_streams', '-show_format', '-of', 'json', downloadPath
    ], { encoding: 'utf8', timeout: 20_000 }));
    const streams = ffprobe.streams || [];
    const audioStreams = streams.filter(stream => stream.codec_type === 'audio');
    report.checks.mediaStreams = {
      status: 'inspected',
      videoStreams: streams.filter(stream => stream.codec_type === 'video').length,
      audioStreams: audioStreams.length,
      audio: audioStreams.length ? 'audio-track-present-content-still-needs-listening-review' : 'no-audio-track'
    };
    report.checks.voice = {
      status: audioStreams.length ? 'audio-track-present-not-proof-of-intelligible-russian-speech' : 'missing',
      note: 'Track presence is not speech recognition; Russian dialogue must be listened to separately.'
    };

    await page.screenshot({ fullPage: true }).then(body =>
      testInfo.attach('live-02-film-result.png', { body, contentType: 'image/png' })
    );
    await testInfo.attach('live-downloaded-film.webm', { path: downloadPath, contentType: 'video/webm' });

    const issues = [];
    if (frameChange.changedPixelRatio < 0.01) issues.push('No meaningful frame-to-frame motion detected.');
    if (orangeSignal < 0.002) issues.push('No clear orange-character pixel signal; inspect attached frames for Foxy.');
    if (!audioStreams.length) issues.push('Export has no audio track; Russian dialogue is not verified.');
    if (pageErrors.length) issues.push('Browser runtime errors occurred.');
    report.findings = issues;
    report.browserErrors = { pageErrors, consoleErrors };
    report.classification = mode === 'local-canvas'
      ? 'local-canvas-output-only-not-AI-video-generation'
      : 'provider-mode-selected-provider-output-not-independently-confirmed';
    report.outcome = issues.length ? 'completed-with-findings' : 'completed-needs-manual-character-review';
  } catch (error) {
    report.outcome = 'failed';
    report.failure = String(error?.stack || error?.message || error).slice(0, 6000);
    report.browserErrors = { pageErrors, consoleErrors };
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    await testInfo.attach('dravex-live-pages-qa-report.json', {
      body: Buffer.from(JSON.stringify(report, null, 2)),
      contentType: 'application/json'
    });
  }
});

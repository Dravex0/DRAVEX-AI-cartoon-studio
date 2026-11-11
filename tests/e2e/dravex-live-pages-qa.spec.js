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

    // Inspect all streams first so the audio-track check is not accidentally
    // filtered out by -select_streams v:0.
    const ffprobe = JSON.parse(execFileSync('ffprobe', [
      '-v', 'error', '-show_streams', '-show_format',
      '-show_entries', 'format=duration:stream=index,codec_type,width,height,duration',
      '-of', 'json', downloadPath
    ], { encoding: 'utf8', timeout: 30_000 }));
    const videoStream = (ffprobe.streams || []).find(stream => stream.codec_type === 'video');
    expect(videoStream).toBeTruthy();

    // Read packet timestamps in a separate video-only pass. This avoids
    // loading audio packets while retaining the complete stream inventory above.
    const videoPackets = JSON.parse(execFileSync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0', '-show_packets',
      '-show_entries', 'packet=pts_time,duration_time',
      '-of', 'json', downloadPath
    ], { encoding: 'utf8', timeout: 30_000 }));
    const packetTimes = (videoPackets.packets || [])
      .map(packet => Number(packet.pts_time))
      .filter(Number.isFinite);
    const packetDurations = (videoPackets.packets || [])
      .map(packet => Number(packet.duration_time))
      .filter(Number.isFinite);
    const streamDuration = Math.max(0, ...(ffprobe.streams || [])
      .map(stream => Number(stream.duration)).filter(Number.isFinite));
    const packetDuration = packetTimes.length
      ? Math.max(...packetTimes) + Math.max(0, ...packetDurations)
      : 0;
    const probedDuration = Math.max(Number(ffprobe.format?.duration) || 0, streamDuration, packetDuration);
    expect(Number.isFinite(probedDuration) && probedDuration > 1).toBeTruthy();

    expect(Number(videoStream.width)).toBeGreaterThan(0);
    expect(Number(videoStream.height)).toBeGreaterThan(0);
    const browserEvidence = {
      durationSeconds: Number(probedDuration.toFixed(2)),
      width: Number(videoStream.width),
      height: Number(videoStream.height),
      decodedFrames: 0
    };
    const sampleTimes = [...new Set([
      0.25,
      probedDuration * 0.25,
      probedDuration * 0.5,
      probedDuration * 0.75,
      Math.max(0.25, probedDuration - 0.25)
    ].map(value => Math.max(0, Math.min(value, probedDuration - 0.05))))];
    for (let index = 0; index < sampleTimes.length; index += 1) {
      const framePath = testInfo.outputPath('live-frame-' + index + '.png');
      execFileSync('ffmpeg', [
        '-v', 'error', '-ss', String(sampleTimes[index]), '-i', downloadPath,
        '-frames:v', '1', '-vf', 'scale=320:-1', '-y', framePath
      ], { encoding: 'utf8', timeout: 20_000 });
      const frameBytes = await readFile(framePath);
      expect(frameBytes.byteLength).toBeGreaterThan(100);
      browserEvidence.decodedFrames += 1;
      report.frames.push({ timeSeconds: Number(sampleTimes[index].toFixed(2)), decodedBy: 'ffmpeg' });
      await testInfo.attach('live-frame-' + index + '.png', { path: framePath, contentType: 'image/png' });
    }
    report.checks.browserPlayback = {
      status: 'container-decoded-by-ffmpeg',
      durationSeconds: browserEvidence.durationSeconds,
      width: browserEvidence.width,
      height: browserEvidence.height,
      decodedFrames: browserEvidence.decodedFrames,
      note: 'The browser player was not used for seeking because MediaRecorder WebM may omit seek metadata.'
    };

    report.checks.visualEvidence = {
      status: 'manual-review-required',
      motionSignal: 'not-automated',
      characterSignal: 'not-automated',
      semanticCharacterRecognition: 'not-automated-review-attached-frames'
    };

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
    if (!audioStreams.length) issues.push('Export has no audio track; Russian dialogue is not verified.');
    if (pageErrors.length) issues.push('Browser runtime errors occurred.');
    if (consoleErrors.length) issues.push('Browser console errors were recorded; inspect the attached report.');
    issues.push('Character identity, red-ball interaction, and story-action accuracy require manual review of the attached decoded frames.');
    report.findings = issues;
    report.browserErrors = { pageErrors, consoleErrors };
    report.quality = {
      generationFlow: { status: 'passed', evidence: 'published-page-prompt-accepted-and-result-panel-shown' },
      webmExport: { status: 'passed', evidence: 'downloaded-file-has-valid-ebml-header' },
      videoDecode: { status: 'passed', evidence: 'ffmpeg-decoded-sampled-frames', decodedFrames: browserEvidence.decodedFrames },
      audio: {
        status: audioStreams.length ? 'track-present-content-unverified' : 'failed-no-audio-track',
        audioStreams: audioStreams.length,
        dialogue: 'not-verified-by-speech-recognition-or-human-listening'
      },
      storySemantics: {
        status: 'manual-review-required',
        checks: ['Foxy identity', 'red ball visible', 'Foxy approaches and pushes ball', 'ball rolls', 'Foxy jumps'],
        evidence: 'attached-decoded-frames',
        automatedSemanticRecognition: false
      }
    };
    report.classification = mode === 'local-canvas'
      ? 'local-canvas-output-only-not-AI-video-generation'
      : 'provider-mode-selected-provider-output-not-independently-confirmed';
    report.outcome = issues.length ? 'completed-with-findings' : 'completed-needs-manual-review';
    report.summary = {
      technicalExport: 'passed',
      audio: report.quality.audio.status,
      story: 'manual-review-required',
      overall: report.outcome,
      humanReadable: !audioStreams.length
        ? 'Video file was created and decoded, but it has no audio track. Story content still needs visual review.'
        : 'Video file was created and decoded. Audio content and story accuracy still need human review.'
    };
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

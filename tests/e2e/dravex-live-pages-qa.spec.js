import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { analyzeRgbaFrameSequence } from '../helpers/video-frame-evidence.js';

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
    const downloadedSha256 = createHash('sha256').update(bytes).digest('hex');
    report.checks.download = {
      status: 'passed',
      filename: download.suggestedFilename(),
      bytes: bytes.byteLength,
      ebml: true,
      sha256: downloadedSha256
    };

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
    const browserEvidence = await page.locator('#finalFilmPlayer').evaluate(async (video, durationSeconds) => {
      const source = video.currentSrc || video.src;
      if (!source.startsWith('blob:')) throw new Error('The film preview is not backed by the exported local Blob URL.');
      const response = await fetch(source);
      if (!response.ok) throw new Error('The film preview Blob could not be read.');
      const previewBlob = await response.blob();
      const digest = await crypto.subtle.digest('SHA-256', await previewBlob.arrayBuffer());
      const sha256 = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
      if (typeof video.requestVideoFrameCallback !== 'function') {
        throw new Error('Chromium does not expose requestVideoFrameCallback for decoded-frame verification.');
      }
      const canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = 54;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Could not create a canvas for browser-decoded frame sampling.');
      const targets = [0.1, 0.3, 0.5, 0.7, 0.9].map(fraction => durationSeconds * fraction);
      const frames = [];
      video.muted = true;
      await video.play();
      try {
        for (let index = 0; index < targets.length; index += 1) {
          const frame = await new Promise((resolve, reject) => {
            let settled = false;
            const timeout = setTimeout(() => {
              if (settled) return;
              settled = true;
              reject(new Error('Timed out waiting for a browser-decoded frame near ' + targets[index].toFixed(2) + ' seconds.'));
            }, 15_000);
            const requestFrame = () => video.requestVideoFrameCallback((_now, metadata) => {
              if (settled) return;
              const mediaTime = Number(metadata?.mediaTime);
              if (!Number.isFinite(mediaTime) || mediaTime + 0.005 < targets[index]) {
                requestFrame();
                return;
              }
              try {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
                const dataUrl = canvas.toDataURL('image/png');
                settled = true;
                clearTimeout(timeout);
                resolve({ timeSeconds: Number(mediaTime.toFixed(3)), data: Array.from(pixels), dataUrl });
              } catch (error) {
                settled = true;
                clearTimeout(timeout);
                reject(error);
              }
            });
            requestFrame();
          });
          frames.push(frame);
        }
      } finally {
        video.pause();
      }
      return {
        sourceKind: 'blob-url',
        blobSize: previewBlob.size,
        sha256,
        width: video.videoWidth,
        height: video.videoHeight,
        durationSeconds: Number.isFinite(video.duration) ? video.duration : null,
        frames
      };
    }, probedDuration);
    expect(browserEvidence.width).toBeGreaterThan(0);
    expect(browserEvidence.height).toBeGreaterThan(0);
    expect(browserEvidence.frames).toHaveLength(5);
    expect(browserEvidence.blobSize).toBe(bytes.byteLength);
    expect(browserEvidence.sha256).toBe(downloadedSha256);
    report.checks.download.previewMatchesDownload = true;
    report.checks.browserPlayback = {
      status: 'decoded-in-browser',
      source: browserEvidence.sourceKind,
      durationSeconds: Number(probedDuration.toFixed(2)),
      width: browserEvidence.width,
      height: browserEvidence.height,
      decodedFrames: browserEvidence.frames.length,
      previewMatchesDownload: true
    };
    for (let index = 0; index < browserEvidence.frames.length; index += 1) {
      const frame = browserEvidence.frames[index];
      report.frames.push({ source: 'browser-player', timeSeconds: frame.timeSeconds, decodedBy: 'chromium' });
      await testInfo.attach('live-browser-frame-' + index + '.png', {
        body: Buffer.from(frame.dataUrl.split(',')[1], 'base64'),
        contentType: 'image/png'
      });
    }
    const visualMetrics = analyzeRgbaFrameSequence(browserEvidence.frames.map(frame => ({
      width: 96,
      height: 54,
      data: frame.data
    })));
    const ffmpegEvidence = {
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
      // Output-side seeking decodes from the start and does not depend on
      // a WebM cue/seek index that MediaRecorder may omit.
      execFileSync('ffmpeg', [
        '-v', 'error', '-i', downloadPath, '-ss', String(sampleTimes[index]),
        '-frames:v', '1', '-vf', 'scale=320:-1', '-y', framePath
      ], { encoding: 'utf8', timeout: 20_000 });
      const frameBytes = await readFile(framePath);
      expect(frameBytes.byteLength).toBeGreaterThan(100);
      ffmpegEvidence.decodedFrames += 1;
      report.frames.push({ source: 'downloaded-webm', timeSeconds: Number(sampleTimes[index].toFixed(2)), decodedBy: 'ffmpeg' });
      await testInfo.attach('live-frame-' + index + '.png', { path: framePath, contentType: 'image/png' });
    }
    report.checks.ffmpegDecode = {
      status: 'decoded-downloaded-webm',
      durationSeconds: ffmpegEvidence.durationSeconds,
      width: ffmpegEvidence.width,
      height: ffmpegEvidence.height,
      decodedFrames: ffmpegEvidence.decodedFrames
    };

    report.checks.visualEvidence = {
      status: 'heuristics-only-manual-review-required',
      motionSignal: visualMetrics.status,
      meanPixelChange: visualMetrics.meanPixelChange,
      changedPixelRatio: visualMetrics.changedPixelRatio,
      orangePixelSignal: visualMetrics.orangeSignal,
      maxOrangePixelRatio: visualMetrics.maxOrangePixelRatio,
      redPixelSignal: visualMetrics.redSignal,
      maxRedPixelRatio: visualMetrics.maxRedPixelRatio,
      semanticCharacterRecognition: 'not-automated-review-attached-frames',
      note: visualMetrics.note
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
    if (visualMetrics.status === 'likely-static') issues.push('Weak frame-to-frame pixel-change signal; motion needs manual review.');
    if (visualMetrics.orangeSignal === 'low-orange-pixel-signal') issues.push('Low orange-color pixel signal; this is not a character-recognition result.');
    if (visualMetrics.redSignal === 'low-red-pixel-signal') issues.push('Low red-color pixel signal; this is not proof that the requested red ball is absent.');
    issues.push('Character identity, red-ball interaction, and story-action accuracy require manual review of the attached decoded frames.');
    report.findings = issues;
    report.browserErrors = { pageErrors, consoleErrors };
    report.quality = {
      generationFlow: { status: 'passed', evidence: 'published-page-prompt-accepted-and-result-panel-shown' },
      webmExport: { status: 'passed', evidence: 'valid-ebml-header-and-sha256-matches-preview-blob', previewMatchesDownload: true },
      videoDecode: { status: 'passed', evidence: 'chromium-player-and-ffmpeg-decoded-sampled-frames', browserFrames: browserEvidence.frames.length, ffmpegFrames: ffmpegEvidence.decodedFrames },
      visualHints: { motion: visualMetrics.status, orange: visualMetrics.orangeSignal, red: visualMetrics.redSignal, semanticRecognition: false },
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
    const reportPath = testInfo.outputPath('dravex-live-pages-qa-report.json');
    await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
    await testInfo.attach('dravex-live-pages-qa-report.json', {
      path: reportPath,
      contentType: 'application/json'
    });
  }
});

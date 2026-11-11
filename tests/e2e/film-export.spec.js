import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('dravex-e2e-language-initialized') !== '1') {
      localStorage.setItem('dravex-ui-language', 'en');
      sessionStorage.setItem('dravex-e2e-language-initialized', '1');
    }
  });
});

test('assembles a storyboard into a non-empty WebM container', async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await page.locator('#idea').fill(
    'A little fox discovers a glowing key in an old forest, follows its light to a hidden gate, opens it, and enters a peaceful garden.'
  );
  await page.locator('#make').click();
  await expect(page.locator('#status')).toContainText(/storyboard created/i);
  await expect(page.locator('#scenes button.scene')).toHaveCount(5);

  // This verifies the local storyboard-to-WebM assembly path. It does not
  // claim that external AI scene-video generation has run.
  await page.locator('#export').click();
  await expect(page.locator('#finalFilmResult')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('#finalFilmDownload')).toHaveAttribute(
    'download',
    'dravex-cartoon-film.webm'
  );

  const film = await page.locator('#finalFilmPlayer').evaluate(async video => {
    const source = video.currentSrc;
    if (!source.startsWith('blob:')) throw new Error('The export preview is not backed by a local Blob URL.');
    const response = await fetch(source);
    if (!response.ok) throw new Error('The exported WebM URL could not be read.');
    const blob = await response.blob();
    const signature = Array.from(new Uint8Array(await blob.slice(0, 4).arrayBuffer()));

    await new Promise((resolve, reject) => {
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return resolve();
      const timeout = setTimeout(() => reject(new Error('Exported WebM metadata did not load.')), 10_000);
      video.addEventListener('loadedmetadata', () => { clearTimeout(timeout); resolve(); }, { once: true });
      video.addEventListener('error', () => { clearTimeout(timeout); reject(new Error(video.error?.message || 'Exported WebM could not be decoded.')); }, { once: true });
    });

    video.muted = true;
    await video.play();
    let decodedFrame = false;
    if (typeof video.requestVideoFrameCallback === 'function') {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Exported WebM produced no decoded video frame.')), 5_000);
        video.requestVideoFrameCallback(() => { decodedFrame = true; clearTimeout(timeout); resolve(); });
      });
    } else {
      await new Promise(resolve => setTimeout(resolve, 300));
      decodedFrame = video.videoWidth > 0 && video.videoHeight > 0;
    }
    const sampledFrames = [];
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 32;
    sampleCanvas.height = 18;
    const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!sampleContext) throw new Error('Could not create a canvas for exported-frame inspection.');
    const sampleCurrentFrame = time => {
      sampleContext.drawImage(video, 0, 0, sampleCanvas.width, sampleCanvas.height);
      const pixels = sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
      const colors = new Set();
      const signatureBytes = [];
      for (let i = 0; i < pixels.length; i += 4) {
        const color = [pixels[i], pixels[i + 1], pixels[i + 2]]
          .map(channel => Math.round(channel / 16)).join(',');
        colors.add(color);
        signatureBytes.push(Math.round(pixels[i] / 16), Math.round(pixels[i + 1] / 16), Math.round(pixels[i + 2] / 16));
      }
      let differenceFromPrevious = null;
      if (sampledFrames.length) {
        const previous = sampledFrames[sampledFrames.length - 1].signatureBytes;
        let changed = 0;
        for (let i = 0; i < signatureBytes.length; i++) {
          if (signatureBytes[i] !== previous[i]) changed++;
        }
        differenceFromPrevious = changed / signatureBytes.length;
      }
      sampledFrames.push({ time, uniqueColors: colors.size, differenceFromPrevious, signatureBytes });
    };
    // Some Chromium mobile builds expose Infinity for MediaRecorder WebM
    // duration while reporting only a short seekable range. That range is not
    // the full film, so do not mistake it for the timeline length.
    const finiteDuration = Number.isFinite(video.duration) && video.duration > 0
      ? video.duration
      : null;
    if (finiteDuration !== null) {
      for (const fraction of [0.1, 0.5, 0.9]) {
        const targetTime = Math.min(finiteDuration - 0.05, Math.max(0, finiteDuration * fraction));
        if (Math.abs(video.currentTime - targetTime) > 0.02) {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timed out seeking to an exported scene frame.')), 5_000);
            video.addEventListener('seeked', () => { clearTimeout(timeout); resolve(); }, { once: true });
            video.currentTime = targetTime;
          });
        }
        sampleCurrentFrame(targetTime);
      }
    } else {
      // Sample decoded frames at meaningful intervals during playback. Adjacent
      // frames can be nearly identical even when the animation is working.
      let previousTime = -Infinity;
      for (let index = 0; index < 3; index++) {
        const time = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timed out waiting for another decoded export frame.')), 5_000);
          const requestNext = () => {
            video.requestVideoFrameCallback((_now, metadata) => {
              if (metadata.mediaTime >= previousTime + 0.75 || previousTime < 0) {
                clearTimeout(timeout);
                resolve(metadata.mediaTime);
              } else {
                requestNext();
              }
            });
          };
          requestNext();
        });
        previousTime = time;
        sampleCurrentFrame(time);
      }
    }
    const frameInspection = sampledFrames.map(({ time, uniqueColors, differenceFromPrevious }) => ({
      time, uniqueColors, differenceFromPrevious
    }));
    video.pause();

    return {
      size: blob.size,
      type: blob.type,
      signature,
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      decodedFrame,
      frameInspection,
      mediaError: video.error?.message || null
    };
  });

  expect(film.size).toBeGreaterThan(0);
  expect(film.type).toContain('video/webm');
  // WebM is an EBML container and starts with the four-byte EBML signature.
  expect(film.signature).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  expect(film.duration).toBeGreaterThan(0);
  expect(film.width).toBeGreaterThan(0);
  expect(film.height).toBeGreaterThan(0);
  expect(film.decodedFrame).toBe(true);
  expect(film.frameInspection).toHaveLength(3);
  expect(film.frameInspection.every(frame => frame.uniqueColors > 8)).toBe(true);
  expect(film.frameInspection.slice(1).every(frame => frame.differenceFromPrevious > 0.02), JSON.stringify(film.frameInspection)).toBe(true);
  expect(film.mediaError).toBeNull();
  expect(pageErrors, 'export should not throw uncaught browser errors').toEqual([]);
});

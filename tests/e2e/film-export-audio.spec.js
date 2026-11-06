import { test, expect } from '@playwright/test';

function createToneWav({ sampleRate = 16000, durationSeconds = 2, frequency = 440 } = {}) {
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
  for (let index = 0; index < sampleCount; index++) {
    const fade = Math.min(1, index / 160, (sampleCount - index) / 160);
    const sample = Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 0.25 * fade;
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
  }
  return buffer;
}

test('keeps selected local music as an audible audio track in the exported WebM', async ({ page }) => {
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

  await page.locator('#audioFile').setInputFiles({
    name: 'dravex-audio-export-test.wav',
    mimeType: 'audio/wav',
    buffer: createToneWav()
  });
  await expect(page.locator('#audioStatus')).toContainText(/local only/i);

  await page.locator('#export').click();
  await expect(page.locator('#finalFilmResult')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('#finalFilmDownload')).toHaveAttribute('download', 'dravex-cartoon-film.webm');

  const audioEvidence = await page.locator('#finalFilmPlayer').evaluate(async video => {
    if (!video.currentSrc.startsWith('blob:')) throw new Error('The exported film is not backed by a local Blob URL.');
    if (typeof video.captureStream !== 'function') throw new Error('This browser cannot inspect decoded media tracks.');
    video.muted = true;
    await video.play();
    const stream = video.captureStream();
    const tracks = stream.getAudioTracks();
    if (tracks.length === 0) throw new Error('The exported WebM has no decoded audio track.');

    video.muted = false;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Web Audio is unavailable for the export audio check.');
    const context = new AudioContextClass();
    try {
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      let peakRms = 0;
      const startedAt = performance.now();
      while (performance.now() - startedAt < 1200) {
        analyser.getFloatTimeDomainData(samples);
        let energy = 0;
        for (const sample of samples) energy += sample * sample;
        peakRms = Math.max(peakRms, Math.sqrt(energy / samples.length));
        await new Promise(resolve => setTimeout(resolve, 60));
      }
      source.disconnect();
      stream.getTracks().forEach(track => track.stop());
      return {
        audioTrackCount: tracks.length,
        audioTrackState: tracks[0].readyState,
        peakRms
      };
    } finally {
      await context.close();
      video.pause();
    }
  });

  expect(audioEvidence.audioTrackCount).toBeGreaterThan(0);
  expect(audioEvidence.audioTrackState).toBe('live');
  expect(audioEvidence.peakRms).toBeGreaterThan(0.001);
  expect(pageErrors, 'audio export should not throw uncaught browser errors').toEqual([]);
});

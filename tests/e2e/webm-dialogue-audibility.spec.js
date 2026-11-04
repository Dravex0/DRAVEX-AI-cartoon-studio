import { test, expect } from '@playwright/test';

const SCENE_SECONDS = 0.8;
const TONE_SECONDS = 0.4;
const SAMPLE_RATE = 48_000;
const TONES = [440, 660, 880];

async function seedThreeToneDialogue(page) {
  await page.goto('/');

  await page.evaluate(async ({ sceneSeconds, toneSeconds, sampleRate, tones }) => {
    const makeWav = (frequency) => {
      const sampleCount = Math.round(sampleRate * toneSeconds);
      const bytes = new ArrayBuffer(44 + sampleCount * 2);
      const view = new DataView(bytes);
      const writeText = (offset, value) => {
        for (let index = 0; index < value.length; index++) {
          view.setUint8(offset + index, value.charCodeAt(index));
        }
      };
      writeText(0, 'RIFF');
      view.setUint32(4, 36 + sampleCount * 2, true);
      writeText(8, 'WAVE');
      writeText(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeText(36, 'data');
      view.setUint32(40, sampleCount * 2, true);
      for (let index = 0; index < sampleCount; index++) {
        const envelope = Math.min(1, index / 240, (sampleCount - index) / 240);
        const sample = Math.sin(2 * Math.PI * frequency * index / sampleRate) * 0.28 * envelope;
        view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
      }
      return new Blob([bytes], { type: 'audio/wav' });
    };

    const openRequest = indexedDB.open('dravex-cartoon-audio-assets', 1);
    const database = await new Promise((resolve, reject) => {
      openRequest.onupgradeneeded = () => {
        if (!openRequest.result.objectStoreNames.contains('voice-audio')) {
          openRequest.result.createObjectStore('voice-audio', { keyPath: 'audioHash' });
        }
      };
      openRequest.onsuccess = () => resolve(openRequest.result);
      openRequest.onerror = () => reject(openRequest.error);
    });

    const sceneMetadata = [];
    const titles = ['Tone 440 Hz', 'Tone 660 Hz', 'Tone 880 Hz'];
    const descriptions = ['First deterministic audio fixture', 'Second deterministic audio fixture', 'Third deterministic audio fixture'];
    const records = [];

    for (let index = 0; index < tones.length; index++) {
      const blob = makeWav(tones[index]);
      const hashBytes = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      const audioHash = Array.from(new Uint8Array(hashBytes), byte => byte.toString(16).padStart(2, '0')).join('');
      records.push({
        audioHash,
        blob,
        filename: 'synthetic-tone-' + tones[index] + '.wav',
        mimeType: 'audio/wav',
        engineUsed: 'playwright-synthetic-fixture',
        durationMs: toneSeconds * 1000,
        sampleRate,
        byteSize: blob.size,
        updatedAt: Date.now()
      });
      const sceneId = 'audio-audit-scene-' + (index + 1);
      sceneMetadata.push({
        id: sceneId,
        title: titles[index],
        description: descriptions[index],
        visibleAction: descriptions[index],
        durationSeconds: sceneSeconds,
        voiceCues: [{
          cueId: sceneId + ':tone',
          characterId: 'Narrator',
          characterName: 'Narrator',
          text: 'Synthetic frequency test ' + tones[index],
          language: 'en',
          audioHash,
          durationMs: toneSeconds * 1000,
          startFrame: 0
        }],
        voiceTimeline: {
          totalDurationMs: toneSeconds * 1000,
          tracks: []
        }
      });
    }

    await new Promise((resolve, reject) => {
      const transaction = database.transaction('voice-audio', 'readwrite');
      const store = transaction.objectStore('voice-audio');
      records.forEach(record => store.put(record));
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();

    localStorage.setItem('dravex-ui-language', 'en');
    localStorage.setItem('dravex-cartoon-draft', JSON.stringify({
      idea: 'Three-scene deterministic audio export test',
      character: 'Narrator',
      style: 'Storybook',
      canvasFormat: 'landscape',
      imageQuality: 'standard',
      duration: String(sceneSeconds),
      language: 'en',
      uiLanguage: 'en',
      titles,
      descriptions,
      sceneMetadata,
      characterBible: [],
      sceneIndex: 0
    }));
  }, {
    sceneSeconds: SCENE_SECONDS,
    toneSeconds: TONE_SECONDS,
    sampleRate: SAMPLE_RATE,
    tones: TONES
  });

  await page.reload();
  await expect(page.locator('#scenes button.scene')).toHaveCount(3);
}

test('records all three synthetic dialogue tones in the exported WebM', async ({ page }) => {
  test.setTimeout(60_000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await seedThreeToneDialogue(page);
  await page.locator('#export').click();
  await expect(page.locator('#finalFilmResult')).toBeVisible({ timeout: 20_000 });

  const inspection = await page.locator('#finalFilmPlayer').evaluate(async (video, expected) => {
    const sourceUrl = video.currentSrc;
    if (!sourceUrl.startsWith('blob:')) throw new Error('Export preview is not backed by a local WebM Blob.');
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error('Could not read the exported WebM Blob.');
    const blob = await response.blob();
    const signature = Array.from(new Uint8Array(await blob.slice(0, 4).arrayBuffer()));
    if (signature.join(',') !== '26,69,223,163') throw new Error('Export is not an EBML/WebM container.');

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Web Audio is unavailable for decoded WebM inspection.');
    const context = new AudioContextClass();

    try {
      const decoded = await context.decodeAudioData(await blob.arrayBuffer());
      if (!decoded.numberOfChannels || !decoded.length || !Number.isFinite(decoded.duration)) {
        throw new Error('Exported WebM contains no decodable audio samples.');
      }
      const channel = decoded.getChannelData(0);
      const sampleRate = decoded.sampleRate;
      const playedDuration = await new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Exported WebM did not reach ended during playback inspection.')), 12_000);
        try {
          video.pause();
          video.currentTime = 0;
          await video.play();
          video.muted = true;
          video.onended = () => {
            clearTimeout(timeout);
            resolve(video.currentTime);
          };
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      const sampleRange = (startSeconds, endSeconds) => {
        const startIndex = Math.max(0, Math.min(channel.length, Math.floor(startSeconds * sampleRate)));
        const endIndex = Math.max(startIndex, Math.min(channel.length, Math.ceil(endSeconds * sampleRate)));
        return channel.subarray(startIndex, endIndex);
      };
      const rms = values => {
        if (!values.length) return 0;
        let sum = 0;
        for (const value of values) sum += value * value;
        return Math.sqrt(sum / values.length);
      };
      const goertzel = (values, frequency) => {
        if (!values.length) return 0;
        const omega = 2 * Math.PI * frequency / sampleRate;
        const coefficient = 2 * Math.cos(omega);
        let previous = 0;
        let previousPrevious = 0;
        for (const value of values) {
          const current = value + coefficient * previous - previousPrevious;
          previousPrevious = previous;
          previous = current;
        }
        return (previous * previous + previousPrevious * previousPrevious
          - coefficient * previous * previousPrevious) / (values.length * values.length);
      };
      const toneChecks = expected.tones.map((frequency, index) => {
        const start = index * expected.sceneSeconds;
        const values = sampleRange(start + 0.10, start + 0.34);
        const powers = expected.tones.map(candidate => goertzel(values, candidate));
        const envelope = [];
        for (let offset = -0.08; offset < expected.toneSeconds + 0.12; offset += 0.02) {
          const windowStart = Math.max(0, start + offset);
          envelope.push({
            time: windowStart,
            rms: rms(sampleRange(windowStart, windowStart + 0.02))
          });
        }
        const active = envelope.filter(point => point.rms > 0.02);
        const activeDuration = active.length ? active[active.length - 1].time + 0.02 - active[0].time : 0;
        return {
          expectedFrequency: frequency,
          sampleCount: values.length,
          rms: rms(values),
          expectedPower: powers[index],
          strongestOtherPower: Math.max(...powers.filter((_power, powerIndex) => powerIndex !== index)),
          activeDuration,
          activeStartOffset: active.length ? active[0].time - start : null
        };
      });
      const silenceChecks = [0, 1].map(index => {
        const start = index * expected.sceneSeconds + expected.toneSeconds + 0.16;
        const values = sampleRange(start, start + 0.16);
        return { start, sampleCount: values.length, rms: rms(values) };
      });

      return {
        size: blob.size,
        type: blob.type,
        signature,
        playedDuration,
        decodedAudioDuration: decoded.duration,
        expectedDuration: expected.sceneSeconds * 3,
        toneChecks,
        silenceChecks
      };
    } finally {
      video.pause();
      await context.close();
    }
  }, { tones: TONES, sceneSeconds: SCENE_SECONDS, toneSeconds: TONE_SECONDS });

  expect(inspection.size).toBeGreaterThan(0);
  expect(inspection.type).toContain('video/webm');
  expect(inspection.signature).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  expect(inspection.playedDuration).toBeGreaterThan(0);
  expect(inspection.decodedAudioDuration).toBeGreaterThan(0);
  expect(Math.abs(inspection.playedDuration - inspection.expectedDuration)).toBeLessThan(0.25);
  expect(inspection.toneChecks).toHaveLength(3);

  for (const check of inspection.toneChecks) {
    expect(check.sampleCount, JSON.stringify(inspection)).toBeGreaterThan(0);
    expect(check.rms, JSON.stringify(inspection)).toBeGreaterThan(0.02);
    expect(check.expectedPower, JSON.stringify(inspection)).toBeGreaterThan(check.strongestOtherPower * 2);
    expect(check.activeDuration, JSON.stringify(inspection)).toBeGreaterThan(0.30);
    // Allow a small encoder/window-boundary tolerance around the 0.4s fixture.
    expect(check.activeDuration, JSON.stringify(inspection)).toBeLessThan(0.55);
    expect(check.activeStartOffset, JSON.stringify(inspection)).not.toBeNull();
    expect(Math.abs(check.activeStartOffset), JSON.stringify(inspection)).toBeLessThan(0.10);
  }

  expect(inspection.silenceChecks).toHaveLength(2);
  for (const check of inspection.silenceChecks) {
    expect(check.sampleCount, JSON.stringify(inspection)).toBeGreaterThan(0);
    expect(check.rms, JSON.stringify(inspection)).toBeLessThan(0.015);
  }
  expect(pageErrors, 'audio export should not throw uncaught browser errors').toEqual([]);
});

import { test, expect } from '@playwright/test';

// This test deliberately makes one real Wan 2.2 request. It is opt-in because
// Hugging Face tokens are personal credentials and ZeroGPU quota is limited.
// Never add the token to the repository or print it in test output.
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test('LIVE: Wan 2.2 generates and the browser decodes a real video clip', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Run the quota-consuming live smoke test once, in desktop Chromium only.');
  const token = process.env.DRAVEX_HF_TOKEN;
  test.skip(!token, 'Set DRAVEX_HF_TOKEN locally to opt in to one real Hugging Face generation request.');
  test.setTimeout(300_000);

  await page.goto('/');
  const report = await page.evaluate(async accessToken => {
    const spaceId = 'zerogpu-aoti/wan2-2-fp8da-aoti-faster';
    const [{ Client, handle_file }, { createHuggingFaceZeroGPUVideoProvider }] = await Promise.all([
      import('https://cdn.jsdelivr.net/npm/@gradio/client@2.7.2/dist/index.min.js'),
      import('/src/huggingface-zerogpu-video-provider.js')
    ]);

    const client = await Client.connect(spaceId, {
      token: accessToken,
      events: ['data', 'status']
    });
    const api = await client.view_api();
    if (!api?.named_endpoints?.['/generate_video']) {
      throw new Error('The live Hugging Face Space does not expose /generate_video.');
    }

    // Draw a deterministic robot source image locally; no image is uploaded
    // except this explicitly submitted source frame.
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#9bd8ef';
    ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = '#6eae73';
    ctx.fillRect(0, 240, 512, 80);
    ctx.fillStyle = '#2776c7';
    ctx.fillRect(205, 125, 102, 100);
    ctx.fillRect(220, 75, 72, 58);
    ctx.fillStyle = '#f7fbff';
    ctx.fillRect(232, 91, 13, 13);
    ctx.fillRect(267, 91, 13, 13);
    ctx.fillStyle = '#15233b';
    ctx.fillRect(237, 96, 5, 5);
    ctx.fillRect(272, 96, 5, 5);
    ctx.fillStyle = '#2776c7';
    ctx.fillRect(177, 140, 28, 16);
    ctx.fillRect(307, 140, 28, 16);
    ctx.fillRect(220, 225, 20, 30);
    ctx.fillRect(272, 225, 20, 30);
    const image = await new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode the local source image.')), 'image/png');
    });

    const progress = [];
    const provider = createHuggingFaceZeroGPUVideoProvider({ client, handleFile });
    const result = await provider.generate({
      taskType: 'image-to-video',
      prompt: 'A small friendly blue robot in a sunny green park slowly raises its right arm and waves hello. The robot stays in the same place. Smooth continuous character motion, stable camera, no scene cut.',
      negativePrompt: 'flicker, camera shake, morphing, extra limbs, duplicate robot, text, watermark',
      durationSeconds: 3,
      fps: 16,
      aspectRatio: '16:10',
      image,
      seed: 20261113,
      referenceImages: []
    }, {
      onProgress: event => progress.push({
        stage: String(event.stage || 'processing'),
        queuePosition: Number.isFinite(event.queuePosition) ? event.queuePosition : null
      })
    });

    if (result.status !== 'completed' || !(result.video instanceof Blob) || result.video.size <= 0) {
      throw new Error('Wan 2.2 did not return a non-empty completed video Blob.');
    }

    const videoUrl = URL.createObjectURL(result.video);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = videoUrl;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out loading real Wan 2.2 video metadata.')), 20000);
      video.addEventListener('loadedmetadata', () => { clearTimeout(timer); resolve(); }, { once: true });
      video.addEventListener('error', () => { clearTimeout(timer); reject(new Error(video.error?.message || 'Browser could not decode the real Wan 2.2 clip.')); }, { once: true });
    });

    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.videoWidth <= 0 || video.videoHeight <= 0) {
      throw new Error('Real Wan 2.2 clip has invalid duration or dimensions.');
    }

    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 64;
    sampleCanvas.height = 40;
    const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
    const samples = [];
    for (const fraction of [0.15, 0.5, 0.85]) {
      const target = Math.min(video.duration - 0.04, Math.max(0, video.duration * fraction));
      if (Math.abs(video.currentTime - target) > 0.02) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Timed out seeking within the real Wan 2.2 clip.')), 10000);
          video.addEventListener('seeked', () => { clearTimeout(timer); resolve(); }, { once: true });
          video.currentTime = target;
        });
      }
      sampleContext.drawImage(video, 0, 0, sampleCanvas.width, sampleCanvas.height);
      const pixels = sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
      samples.push(Array.from(pixels).filter((_, index) => index % 4 !== 3));
    }
    let changedRatio = 0;
    let compared = 0;
    for (let i = 0; i < samples[0].length; i++) {
      if (samples[0][i] !== samples[2][i]) changedRatio++;
      compared++;
    }

    const evidence = {
      classification: 'live-model-generation',
      provider: 'Hugging Face ZeroGPU Wan 2.2 14B Fast',
      taskType: 'image-to-video',
      durationSeconds: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      mimeType: result.video.type,
      videoBytes: result.video.size,
      decodedFrameSamples: samples.length,
      firstToLastFramePixelChangeRatio: compared ? changedRatio / compared : 0,
      progressStages: progress.map(item => item.stage)
    };
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(videoUrl);
    return evidence;
  }, token);

  expect(report.classification).toBe('live-model-generation');
  expect(report.videoBytes).toBeGreaterThan(1024);
  expect(report.durationSeconds).toBeGreaterThan(0);
  expect(report.width).toBeGreaterThan(0);
  expect(report.height).toBeGreaterThan(0);
  expect(report.decodedFrameSamples).toBe(3);
  expect(report.firstToLastFramePixelChangeRatio).toBeGreaterThan(0.005);

  await testInfo.attach('live-wan22-generation-evidence.json', {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: 'application/json'
  });
});

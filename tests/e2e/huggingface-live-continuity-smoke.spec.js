import { test, expect } from '@playwright/test';

// Opt-in: spends ZeroGPU quota on TWO real Wan 2.2 generations.
// The drawn forest-adventurer is a deterministic stand-in, not the user's
// original Kel artwork. This verifies real frame-handoff mechanics only.
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test('LIVE: Wan 2.2 continues scene two from scene one final frame', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Run quota-consuming live continuity smoke only in desktop Chromium.');
  const token = process.env.DRAVEX_HF_TOKEN;
  test.skip(!token, 'Set DRAVEX_HF_TOKEN as a GitHub Actions secret to opt in to two real Wan 2.2 generations.');
  test.setTimeout(600_000);

  await page.goto('/');
  const evidence = await page.evaluate(async accessToken => {
    const [{ Client, handle_file: handleFile }, { createHuggingFaceZeroGPUVideoProvider }, { captureLastFrameImage }] = await Promise.all([
      import('https://cdn.jsdelivr.net/npm/@gradio/client@2.7.2/dist/index.min.js'),
      import('/src/huggingface-zerogpu-video-provider.js'),
      import('/src/video-last-frame.js')
    ]);
    const client = await Client.connect('zerogpu-aoti/wan2-2-fp8da-aoti-faster', { token: accessToken, events: ['data', 'status'] });
    const api = await client.view_api();
    if (!api?.named_endpoints?.['/generate_video']) throw new Error('The live Hugging Face Space does not expose /generate_video.');

    // Simplified green-cloaked forest adventurer; not the original Kel reference.
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 320;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#a8d9ed'; ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = '#6caa70'; ctx.fillRect(0, 245, 512, 75);
    ctx.fillStyle = '#5b3928'; ctx.beginPath(); ctx.arc(256, 102, 29, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9a477'; ctx.beginPath(); ctx.arc(256, 112, 21, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#263a2a'; ctx.beginPath(); ctx.moveTo(232, 139); ctx.lineTo(280, 139); ctx.lineTo(318, 245); ctx.lineTo(194, 245); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5b3928'; ctx.fillRect(241, 238, 12, 36); ctx.fillRect(261, 238, 12, 36);
    ctx.fillStyle = '#f5f0dd'; ctx.fillRect(246, 108, 5, 5); ctx.fillRect(263, 108, 5, 5);
    const sourceImage = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode source image.')), 'image/png'));

    const provider = createHuggingFaceZeroGPUVideoProvider({ client, handleFile });
    const progress = [];
    const generate = (image, prompt, seed) => provider.generate({
      taskType: 'image-to-video', prompt,
      negativePrompt: 'character redesign, different clothing, duplicate person, extra limbs, flicker, camera shake, text, watermark',
      durationSeconds: 3, fps: 16, aspectRatio: '16:10', image, seed, referenceImages: []
    }, { onProgress: event => progress.push(String(event.stage || 'processing')) });

    const first = await generate(sourceImage,
      'Kel, a young forest adventurer wearing a dark green cloak, notices a small mechanical bird near a fallen branch. Gentle natural movement, stable camera, preserve the character design.',
      2026111301);
    if (first.status !== 'completed' || !(first.video instanceof Blob) || first.video.size <= 0) throw new Error('First real Wan 2.2 scene returned no video.');

    const continuityFrame = await captureLastFrameImage(first.video);
    if (!(continuityFrame instanceof Blob) || continuityFrame.type !== 'image/png' || continuityFrame.size <= 0) throw new Error('Could not extract a valid PNG final frame.');

    const second = await generate(continuityFrame,
      'Continue the exact moment shown in the supplied final frame. Kel, the same young forest adventurer, gently lifts the fallen branch and frees the small mechanical bird. Preserve the same face, body proportions, dark green cloak, colors, character identity, and forest layout. Continue forward; do not restart or redesign.',
      2026111302);
    if (second.status !== 'completed' || !(second.video instanceof Blob) || second.video.size <= 0) throw new Error('Second real Wan 2.2 scene returned no video.');

    const videoUrl = URL.createObjectURL(second.video);
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.preload = 'auto'; video.src = videoUrl;
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timed out loading second real clip.')), 20000);
        video.addEventListener('loadedmetadata', () => { clearTimeout(timer); resolve(); }, { once: true });
        video.addEventListener('error', () => { clearTimeout(timer); reject(new Error(video.error?.message || 'Second clip decode failed.')); }, { once: true });
      });
      if (!(video.duration > 0) || !(video.videoWidth > 0) || !(video.videoHeight > 0)) throw new Error('Second clip has invalid metadata.');
      return {
        classification: 'live-two-scene-model-generation-with-real-frame-handoff',
        provider: 'Hugging Face ZeroGPU Wan 2.2 14B Fast',
        characterSource: 'simplified forest-adventurer stand-in; not original Kel artwork',
        firstClipBytes: first.video.size, firstClipMimeType: first.video.type,
        continuityFrameBytes: continuityFrame.size, continuityFrameMimeType: continuityFrame.type,
        secondClipBytes: second.video.size, secondClipMimeType: second.video.type,
        secondClipDurationSeconds: video.duration, secondClipWidth: video.videoWidth, secondClipHeight: video.videoHeight,
        realGenerationRequests: 2, progressStages: progress
      };
    } finally {
      video.pause(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(videoUrl);
    }
  }, token);

  expect(evidence.classification).toBe('live-two-scene-model-generation-with-real-frame-handoff');
  expect(evidence.realGenerationRequests).toBe(2);
  expect(evidence.firstClipBytes).toBeGreaterThan(1024);
  expect(evidence.continuityFrameBytes).toBeGreaterThan(100);
  expect(evidence.continuityFrameMimeType).toBe('image/png');
  expect(evidence.secondClipBytes).toBeGreaterThan(1024);
  expect(evidence.secondClipDurationSeconds).toBeGreaterThan(0);
  expect(evidence.secondClipWidth).toBeGreaterThan(0);
  expect(evidence.secondClipHeight).toBeGreaterThan(0);

  await testInfo.attach('live-wan22-two-scene-continuity-evidence.json', {
    body: Buffer.from(JSON.stringify(evidence, null, 2)), contentType: 'application/json'
  });
});

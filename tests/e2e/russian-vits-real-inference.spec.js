import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const enabled = process.env.DRAVEX_REAL_RUSSIAN_VITS === "1";

test("real Russian VITS weights synthesize distinct non-silent female and male voices", async ({ page }, testInfo) => {
  test.skip(!enabled, "Opt in with DRAVEX_REAL_RUSSIAN_VITS=1; this downloads about 50.8 MB of ONNX weights.");
  test.setTimeout(10 * 60 * 1000);
  await page.goto("/");
  const downloads = [];
  page.on("download", async download => {
    const path = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(path);
    downloads.push({ filename: download.suggestedFilename(), path });
  });

  const report = await page.evaluate(async () => {
    const { runRussianVitsRealInferenceSmoke } = await import("/src/russian-vits-real-inference-smoke.js");
    return runRussianVitsRealInferenceSmoke({ downloadWavs: true });
  });

  expect(report.modelBytes).toBe(50_800_000);
  expect(report.revision).toBe("0e9a395");
  expect(report.availableVoices).toEqual(["ru-female", "ru-male"]);
  expect(report.results).toHaveLength(2);
  expect(new Set(report.results.map(item => item.speakerId)).size).toBe(2);
  expect(new Set(report.results.map(item => item.sha256)).size).toBe(2);
  for (const result of report.results) {
    expect(result.sampleCount).toBeGreaterThan(0);
    expect(result.sampleRate).toBe(16_000);
    expect(result.durationMs).toBeGreaterThan(250);
    expect(result.durationMs).toBeLessThan(15_000);
    expect(result.peak).toBeGreaterThan(0.001);
    expect(result.rms).toBeGreaterThan(0.0001);
    expect(result.mouthEnvelopeFrames).toBeGreaterThan(0);
    expect(result.mouthActiveFrames).toBeGreaterThan(0);
    expect(result.visemeSource).toBe("text-grapheme-fallback");
    expect(result.wavBytes).toBeGreaterThan(44);
  }
  await expect.poll(() => downloads.length, { timeout: 15_000 }).toBe(2);
  const exportFixture = await page.evaluate(async ({ files }) => {
    const [{ createVoiceAudioStorage }, { buildSceneVoiceTimeline }] = await Promise.all([
      import("/src/voice-audio-storage.js"),
      import("/src/scene-voice-workflow.js")
    ]);
    const storage = createVoiceAudioStorage();
    const dialogue = [
      { characterId: "Героиня", characterName: "Героиня", text: "Привет! Сегодня мы создаём мультфильм.", language: "ru" },
      { characterId: "Герой", characterName: "Герой", text: "Да! У каждого героя будет свой голос.", language: "ru" }
    ];
    const artifacts = [];
    for (const file of files) {
      const binary = atob(file.base64);
      const bytes = new Uint8Array(binary.length);
      for (let offset = 0; offset < binary.length; offset++) bytes[offset] = binary.charCodeAt(offset);
      const blob = new Blob([bytes], { type: "audio/wav" });
      await storage.put(file.sha256, blob, {
        filename: "ru-vits-" + file.voiceId + ".wav",
        mimeType: "audio/wav",
        engineUsed: "real-russian-vits",
        durationMs: file.durationMs,
        sampleRate: file.sampleRate
      });
      artifacts.push({ audioHash: file.sha256, durationMs: file.durationMs, voiceId: file.voiceId });
    }
    const sceneId = "real-russian-vits-webm-export";
    const scheduled = buildSceneVoiceTimeline({ sceneId, dialogue, artifacts, fps: 24, gapMs: 120 });
    const durationSeconds = Math.max(8, Math.ceil((scheduled.timeline.totalDurationMs + 1500) / 1000));
    const titles = ["Два персонажа — два голоса"];
    const descriptions = ["Проверка настоящей русской речи в итоговом WebM"];
    const sceneMetadata = [{
      id: sceneId,
      title: titles[0],
      description: descriptions[0],
      visibleAction: descriptions[0],
      durationSeconds,
      dialogue,
      voiceCues: scheduled.cues,
      voiceTimeline: scheduled.timeline
    }];
    localStorage.setItem("dravex-ui-language", "en");
    localStorage.setItem("dravex-cartoon-draft", JSON.stringify({
      idea: "Real Russian VITS to WebM integration test",
      character: "Героиня",
      style: "Storybook",
      canvasFormat: "landscape",
      imageQuality: "standard",
      duration: String(durationSeconds),
      language: "ru",
      uiLanguage: "en",
      titles,
      descriptions,
      sceneMetadata,
      characterBible: [],
      sceneIndex: 0
    }));
    return {
      cueStartsMs: scheduled.cues.map(cue => cue.startFrame * 1000 / 24),
      cueDurationsMs: scheduled.cues.map(cue => cue.durationMs),
      voiceIds: scheduled.cues.map(cue => cue.voiceId),
      hashes: scheduled.cues.map(cue => cue.audioHash)
    };
  }, {
    files: report.results.map(result => {
      const download = downloads.find(item => item.filename === "ru-vits-" + result.voiceId + ".wav");
      if (!download) throw new Error("Missing downloaded WAV for " + result.voiceId + ".");
      return {
        voiceId: result.voiceId,
        sha256: result.sha256,
        durationMs: result.durationMs,
        sampleRate: result.sampleRate,
        base64: readFileSync(download.path).toString("base64")
      };
    })
  });

  await page.reload();
  await expect(page.locator("#scenes button.scene")).toHaveCount(1);
  await page.locator("#export").click();
  await expect(page.locator("#finalFilmResult")).toBeVisible({ timeout: 30_000 });
  const exportEvidence = await page.locator("#finalFilmPlayer").evaluate(async (video, expected) => {
    if (!video.currentSrc.startsWith("blob:")) throw new Error("Final WebM preview is not backed by a local Blob.");
    const response = await fetch(video.currentSrc);
    if (!response.ok) throw new Error("Could not read the final WebM Blob.");
    const blob = await response.blob();
    const signature = Array.from(new Uint8Array(await blob.slice(0, 4).arrayBuffer()));
    if (signature.join(",") !== "26,69,223,163") throw new Error("Final export is not an EBML/WebM container.");
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Web Audio is unavailable for final-export inspection.");
    const context = new AudioContextClass();
    try {
      const decoded = await context.decodeAudioData(await blob.arrayBuffer());
      if (!decoded.numberOfChannels || !decoded.length || !Number.isFinite(decoded.duration)) {
        throw new Error("The final WebM has no decodable audio track.");
      }
      const channel = decoded.getChannelData(0);
      const voiceChecks = expected.cueStartsMs.map((startMs, index) => {
        const durationMs = expected.cueDurationsMs[index];
        const windowMs = Math.min(250, durationMs * 0.4);
        const windowStartMs = startMs + Math.max(0, (durationMs - windowMs) / 2);
        const first = Math.max(0, Math.min(channel.length, Math.floor(windowStartMs * decoded.sampleRate / 1000)));
        const last = Math.max(first, Math.min(channel.length, Math.ceil((windowStartMs + windowMs) * decoded.sampleRate / 1000)));
        const samples = channel.subarray(first, last);
        let energy = 0;
        for (const sample of samples) energy += sample * sample;
        return {
          voiceId: expected.voiceIds[index],
          audioHash: expected.hashes[index],
          sampleCount: samples.length,
          rms: samples.length ? Math.sqrt(energy / samples.length) : 0
        };
      });
      return {
        size: blob.size,
        mimeType: blob.type,
        signature,
        audioDuration: decoded.duration,
        channels: decoded.numberOfChannels,
        voiceChecks
      };
    } finally {
      await context.close();
    }
  }, exportFixture);
  expect(exportEvidence.size).toBeGreaterThan(0);
  expect(exportEvidence.mimeType).toContain("video/webm");
  expect(exportEvidence.signature).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  expect(exportEvidence.audioDuration).toBeGreaterThan(1);
  expect(exportEvidence.channels).toBeGreaterThan(0);
  expect(exportEvidence.voiceChecks).toHaveLength(2);
  for (const voice of exportEvidence.voiceChecks) {
    expect(voice.sampleCount).toBeGreaterThan(0);
    expect(voice.rms).toBeGreaterThan(0.00005);
  }
  expect(new Set(exportEvidence.voiceChecks.map(voice => voice.audioHash)).size).toBe(2);
  await testInfo.attach("russian-vits-webm-export-evidence", {
    body: Buffer.from(JSON.stringify({ exportFixture, exportEvidence }, null, 2)),
    contentType: "application/json"
  });

  const outputDir = testInfo.outputPath("russian-vits-real-weights");
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, "report.json"), JSON.stringify(report, null, 2));
  await testInfo.attach("russian-vits-real-weights-report", {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: "application/json"
  });
});

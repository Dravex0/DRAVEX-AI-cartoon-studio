import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const enabled = process.env.DRAVEX_REAL_PIPER === "1";

test("real Ukrainian Piper weights synthesize distinct non-silent audio for all three speakers", async ({ page }, testInfo) => {
  test.skip(!enabled, "Opt in with DRAVEX_REAL_PIPER=1; this downloads about 76.7 MB of model weights.");
  test.setTimeout(10 * 60 * 1000);

  await page.goto("/");
  const downloads = [];
  page.on("download", async download => {
    const path = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(path);
    downloads.push({ filename: download.suggestedFilename(), path });
  });

  const report = await page.evaluate(async () => {
    const { runPiperRealInferenceSmoke } = await import("/src/piper-real-inference-smoke.js");
    return runPiperRealInferenceSmoke({ downloadWavs: true });
  });

  expect(report.modelBytes).toBe(76_735_663);
  expect(report.availableVoices).toEqual(["lada", "mykyta", "tetiana"]);
  expect(report.results).toHaveLength(3);
  expect(new Set(report.results.map(result => result.speakerId)).size).toBe(3);
  expect(new Set(report.results.map(result => result.sha256)).size).toBe(3);

  const outputDir = testInfo.outputPath("piper-real-weights");
  mkdirSync(outputDir, { recursive: true });
  for (const result of report.results) {
    expect(result.sampleCount).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThan(250);
    expect(result.durationMs).toBeLessThan(15_000);
    expect(result.sampleRate).toBe(22_050);
    expect(result.peak).toBeGreaterThan(0.001);
    expect(result.rms).toBeGreaterThan(0.0001);
    expect(result.mouthEnvelopeFrames).toBeGreaterThan(0);
    expect(result.mouthActiveFrames).toBeGreaterThan(0);
    expect(result.visemeSource).toBe("text-grapheme-fallback");
    expect(result.wavBytes).toBeGreaterThan(44);
  }

  await expect.poll(() => downloads.length, { timeout: 15_000 }).toBe(3);
  const summary = {
    modelId: report.modelId,
    modelBytes: report.modelBytes,
    dialogue: report.dialogue,
    availableVoices: report.availableVoices,
    results: report.results
  };
  writeFileSync(join(outputDir, "report.json"), JSON.stringify(summary, null, 2));
  await testInfo.attach("piper-real-weights-report", {
    body: Buffer.from(JSON.stringify(summary, null, 2)),
    contentType: "application/json"
  });
});

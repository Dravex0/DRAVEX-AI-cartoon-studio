import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
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
  const outputDir = testInfo.outputPath("russian-vits-real-weights");
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, "report.json"), JSON.stringify(report, null, 2));
  await testInfo.attach("russian-vits-real-weights-report", {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: "application/json"
  });
});

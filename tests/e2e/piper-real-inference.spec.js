import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const enabled = process.env.DRAVEX_REAL_PIPER === "1";

test("real Ukrainian Piper weights synthesize non-silent audio for all three speakers", async ({ page }, testInfo) => {
  test.skip(!enabled, "Opt in with DRAVEX_REAL_PIPER=1; this downloads about 76.7 MB of model weights.");
  test.setTimeout(10 * 60 * 1000);

  await page.goto("/");
  const report = await page.evaluate(async () => {
    const { runPiperRealInferenceSmoke } = await import("/src/piper-real-inference-smoke.js");
    return runPiperRealInferenceSmoke();
  });

  expect(report.modelBytes).toBe(76_735_663);
  expect(report.availableVoices).toEqual(["lada", "mykyta", "tetiana"]);
  expect(report.results).toHaveLength(3);

  const outputDir = testInfo.outputPath("piper-real-weights");
  mkdirSync(outputDir, { recursive: true });
  const summary = {
    modelId: report.modelId,
    modelBytes: report.modelBytes,
    dialogue: report.dialogue,
    availableVoices: report.availableVoices,
    results: report.results.map(({ wavBytes, ...metadata }) => metadata)
  };

  for (const result of report.results) {
    expect(result.sampleCount).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThan(250);
    expect(result.durationMs).toBeLessThan(15_000);
    expect(result.peak).toBeGreaterThan(0.001);
    expect(result.rms).toBeGreaterThan(0.0001);
    expect(result.speakerId).toEqual(expect.any(Number));
    writeFileSync(join(outputDir, `uk-piper-${result.voiceId}.wav`), Buffer.from(result.wavBytes));
  }
  writeFileSync(join(outputDir, "report.json"), JSON.stringify(summary, null, 2));
  await testInfo.attach("piper-real-weights-report", {
    body: Buffer.from(JSON.stringify(summary, null, 2)),
    contentType: "application/json"
  });
});

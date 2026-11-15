# Real Ukrainian Piper inference smoke test

The regular unit and Playwright suites intentionally use lightweight fake ONNX
sessions. They must not download model weights or make CI depend on Hugging Face.
This opt-in test is separate and loads the real 76,735,663-byte Ukrainian Piper
ONNX model in Chromium through ONNX Runtime Web/WASM.

## Run locally

1. Install dependencies with `npm install`.
2. Build the ONNX Runtime WASM assets with `npm run build`.
3. Run:

   ```sh
   DRAVEX_REAL_PIPER=1 npx playwright test tests/e2e/piper-real-inference.spec.js --project=chromium-desktop --workers=1
   ```

The test loads the model once in the browser, synthesizes the same Ukrainian
sentence with `lada`, `mykyta`, and `tetiana`, checks finite/non-silent
samples, plausible duration and distinct ONNX speaker IDs, then saves three WAV
files and a JSON report under the Playwright test-results output.

## Run in GitHub Actions

Open **Actions → DRAVEX Playwright browser tests → Run workflow** and enable
`real_piper`. Leave it disabled for normal CI. The opt-in run builds the local
WASM assets, downloads the real model and attaches the WAV files/report to the
workflow artifact.

## What a pass proves (and does not prove)

A pass proves that the pinned real ONNX weights loaded in Chromium/WASM and
produced non-silent WAV samples for each of the three configured speaker IDs.
It does not automatically prove that the voices sound perceptibly different,
that pronunciation is correct to a native Ukrainian listener, or that a
physical Android phone has sufficient memory/performance. Listen to the three
attached WAVs and run the same test on a real Android device before making
those claims. Pixel 7 in Playwright is device emulation, not physical hardware.

The test is opt-in because the model download is large and requires network
access. Model weights are never committed to the repository.

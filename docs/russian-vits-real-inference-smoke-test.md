# Russian local multi-speaker VITS smoke test

DRAVEX has an isolated browser-local Russian VITS adapter for
`utrobinmv/tts_ru_free_hf_vits_low_multispeaker`.

## Model facts

- Pinned Hub revision: `0e9a395`
- ONNX weights: about 50.8 MB
- Sample rate: 16 kHz mono
- Speakers: `ru-female` (speaker ID 0) and `ru-male` (speaker ID 1)
- Model card license: Apache-2.0
- Runtime: ONNX Runtime Web / WASM
- Tokenizer: pinned `vocab.json` with the model's character-level VITS encoding (blank token ID 0 inserted between characters); this checkpoint does not publish `tokenizer.json`.
- Weights are downloaded only when the user loads Russian speech; synthesis runs in the browser.
- The model card recommends lowercase text and explicit stress marks for better pronunciation. This prototype lowercases text but does not yet run a Russian accentuation model.

Model card: https://huggingface.co/utrobinmv/tts_ru_free_hf_vits_low_multispeaker
Pinned weights: https://huggingface.co/utrobinmv/tts_ru_free_hf_vits_low_multispeaker/resolve/0e9a395/model.onnx
License: https://huggingface.co/utrobinmv/tts_ru_free_hf_vits_low_multispeaker/blob/main/LICENSE

## Real inference validation

This branch's Playwright workflow downloads the pinned ONNX weights and runs actual browser inference for both speaker IDs on Desktop Chromium. The test verifies:

- ONNX session has `input_ids`, `attention_mask`, and `sid` inputs.
- Both speaker IDs produce non-silent finite Float32 audio.
- WAV outputs have plausible duration and different SHA-256 hashes.
- Generated audio produces an audio-reactive mouth envelope and a text-grapheme viseme fallback.
- Both WAVs are captured as real browser downloads.

The test does not claim that the two voices are subjectively distinct to every listener, that pronunciation is perfect, or that lip-sync is phoneme-perfect. The viseme timeline is a text-grapheme fallback, not phoneme alignment. Physical Android-device inference and memory use still require separate validation.

## Manual command

```bash
npm run build
DRAVEX_REAL_RUSSIAN_VITS=1 npx playwright test tests/e2e/russian-vits-real-inference.spec.js --project=chromium-desktop --workers=1
```

Ordinary CI skips this weight-download test except on the dedicated experimental branch.

# Ukrainian Piper local voice integration

## What is connected

The Ukrainian locale in the local TTS registry now selects the MIT-licensed
`uk_UA-ukrainian_tts-medium` Piper model. The browser-local TTS engine loads the
ONNX model and its JSON config on explicit request and runs inference in the
browser through ONNX Runtime Web's WASM execution provider.

The model exposes three speaker IDs:

- `lada` — speaker 0
- `mykyta` — speaker 1
- `tetiana` — speaker 2

The chosen character `voiceId` is passed to the Piper runtime and converted to
the model's exact `sid` tensor. Unknown voice IDs fail instead of falling back
to speaker 0. Generated Float32 samples are encoded as PCM16 WAV and passed
through the existing verified local audio artifact store.

## Device and download behavior

- ONNX Runtime Web is pinned to version 1.31.1 and uses its WASM-only entry.
- The build copies the matching WASM and loader assets into
  `public/vendor/onnxruntime/`, which Vite includes in the Pages output.
- WASM is configured for one thread to avoid requiring cross-origin isolation.
- The ONNX model is about 76.7 MB and is fetched from Hugging Face only when the
  user explicitly loads Ukrainian speech. Internet access is required for the
  initial model fetch; persistent offline model caching is not yet guaranteed.
- Inference itself runs locally in the browser. No paid API or remote inference
  service is used by this path.

## Proof boundary

Automated tests verify registry selection, model URL routing, the selected voice
ID, WAV encoding/storage, text-to-ID mapping, ONNX tensor dtypes and shapes, and
strict speaker validation. CI and simulated browser tests do not prove that the
real ONNX weights have generated intelligible speech or that all three voices
sound perceptibly distinct on a physical Android device.

This Piper adapter does not currently provide phoneme timing or viseme events.
Therefore, it does not by itself prove or enable lip-sync for these voices.
Real model/WAV inspection and Android performance testing remain required.

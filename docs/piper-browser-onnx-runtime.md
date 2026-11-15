# Piper browser ONNX runtime prototype

This branch adds an isolated browser adapter for Piper models whose config declares
`phoneme_type: "text"`. The Ukrainian `uk_UA-ukrainian_tts-medium` model uses a
character-to-ID map, so it must **not** be sent through the eSpeak phonemizer used
by many other Piper voices.

## Runtime contract

- Inject an ONNX Runtime Web instance (`ort`) and use the WASM execution provider.
- Fetch the ONNX file and its JSON sidecar only after the user explicitly chooses
  to load the voice model.
- Convert lowercase text directly through `phoneme_id_map`, adding Piper BOS,
  interspersed padding and EOS symbols.
- Resolve the character's voice through the loaded config's `speaker_id_map`.
- Pass `sid: int64[1]` only when the ONNX graph declares it (multi-speaker model).
- Return actual Float32 audio samples and the model's configured sample rate.

The runtime is intentionally dependency-injected. It does not add ONNX Runtime,
download a model, or bundle WASM assets. Production integration must vendor the
matching ORT JS/WASM files, configure `ort.env.wasm.wasmPaths` to a same-origin
asset directory, and connect this adapter to the existing browser-local TTS engine.

## Current proof boundary

Unit tests use a fake ONNX session. They verify tensor shapes, dtypes, exact speaker
routing and failure behavior; they do **not** prove that the real 76.7 MB model
loads, that generated speech is intelligible, that the three voices sound distinct,
or that Android performance is acceptable. Those require real model inference and
audio artifact inspection before this runtime can be exposed in the app.

# Ukrainian Piper browser ONNX runtime

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

The adapter is now connected to the browser-local TTS engine for the Ukrainian
locale. The application imports the WASM-only ONNX Runtime Web build, sets it to
one thread for browsers without cross-origin isolation, and copies the matching
WASM assets into the Vite/Pages output at build time. The model and JSON config
are fetched only when the user loads Ukrainian speech.

## Current proof boundary

Unit tests use a fake ONNX session. They verify tensor shapes, dtypes, exact speaker
routing and failure behavior; they do **not** prove that the real 76.7 MB model
loads, that generated speech is intelligible, that the three voices sound distinct,
or that Android performance is acceptable. The app integration is therefore
available for controlled testing, not yet a claim of verified production-quality
speech. Piper output currently has no phoneme timing stream, so this integration
does not claim character lip-sync support.

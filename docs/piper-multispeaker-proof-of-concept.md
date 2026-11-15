# Piper multi-speaker proof of concept

This isolated catalog records the verified Ukrainian Piper medium model and its three
speaker IDs. It deliberately does not register the model in the production TTS engine.

## Model facts

- Model: `uk_UA-ukrainian_tts-medium`
- ONNX size: 76,735,663 bytes (~73.2 MiB)
- Sample rate: 22,050 Hz
- Speakers: `lada` (0), `mykyta` (1), `tetiana` (2)
- License: MIT

The ONNX config is the source of truth at runtime. Use
`resolvePiperSpeakerId(modelConfig, characterVoiceId)` and pass the returned number
as the `speakerId` argument to Piper's ONNX inference. An unknown explicitly
assigned voice must fail; it must never fall back to speaker 0.

## Deliberate limitations

This is metadata and routing groundwork only. It does not download model weights,
run ONNX inference, bundle Piper's phonemizer/WASM assets, produce WAV audio, or
prove Android performance. Do not show this model as available in the app until
the real browser runtime and generated audio have been tested.

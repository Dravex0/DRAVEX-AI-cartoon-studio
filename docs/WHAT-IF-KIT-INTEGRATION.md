# What-if Kit integration (DRAVEX)

This integration imports the What-if Kit's `episode.json` storyboard data into DRAVEX's
provider-neutral scene model. It is deliberately an adapter, not a copy of the Kit runtime.

## Included

- `src/what-if-episode-adapter.js`: bounded import, character ID mapping, narration/story
  attribution, camera/action/prop prompt conversion, and explicit warnings for unsupported tokens.
- `tests/what-if-episode-adapter.test.js`: import, warning, empty-input, and input-limit tests.

## Important compatibility boundary

The archive's rendering engine is Remotion + React and its production script expects a local
Node/npm/FFmpeg setup, Python `requests` + Pillow, and optionally an ElevenLabs API key.
DRAVEX uses its own browser scene model, image/video providers, voice pipeline, and WebM export.
The Remotion engine, Python build script, ElevenLabs calls, and kit-specific SFX mixer are **not**
wired into DRAVEX. Copying them would introduce a second renderer and paid-key assumptions,
not improve the existing DRAVEX pipeline safely.

The adapter keeps What-if narration in `sourceStoryText`; it does not pretend that narration
has been synthesized. The existing DRAVEX voice workflow must generate and validate the audio.
Likewise, imported poses/props/effects are translated into image/motion prompts; only existing
DRAVEX renderers/providers can produce the corresponding visible animation. The import diagnostics
warn when a token is outside the adapter's declared compatibility set.

## Intended use

Call `convertWhatIfEpisode(episodeJson, { characterMap })`, inspect
`diagnostics.ok/errors/warnings`, then pass `scenes` through the normal DRAVEX story QA and
production gates. Do not bypass those gates or mark a film complete before a playable export exists.

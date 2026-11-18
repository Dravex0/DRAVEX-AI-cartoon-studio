# What-if Kit integration (DRAVEX)

This integration imports the What-if Kit's `episode.json` storyboard data into DRAVEX's
provider-neutral scene model. It is deliberately an adapter, not a copy of the Kit runtime.

## Included

- `src/what-if-episode-adapter.js`: bounded import, character ID mapping, narration/story
  attribution, camera/action/prop prompt conversion, and explicit warnings for unsupported tokens.
- Supported explicit actor poses (walk, run, jump, wave, dance, punch/kick, defend, dodge)
  become a validated DRAVEX action phase. Explicit `x` → `toX` movement adds a direction cue.
- The import UI preserves the structured actor cast, reuses matching character rigs/sprite layers
  already present in the previous storyboard, and runs DRAVEX automatic motion preparation.
- `tests/what-if-episode-adapter.test.js`: import, action mapping, warning, empty-input, and input-limit tests.

## Important compatibility boundary

The archive's rendering engine is Remotion + React and its production script expects a local
Node/npm/FFmpeg setup, Python `requests` + Pillow, and optionally an ElevenLabs API key.
DRAVEX uses its own browser scene model, image/video providers, voice pipeline, and WebM export.
The Remotion engine, Python build script, ElevenLabs calls, and kit-specific SFX mixer are **not**
wired into DRAVEX. Copying them would introduce a second renderer and paid-key assumptions,
not improve the existing DRAVEX pipeline safely.

The adapter keeps What-if narration in `sourceStoryText`; it does not pretend that narration
has been synthesized. The existing DRAVEX voice workflow must generate and validate the audio.
For the supported pose subset above, the adapter also creates a source-grounded action timeline
that DRAVEX can map to its deterministic rig presets or whole-sprite movement planner. This only
produces visible motion when a matching, valid character rig or sprite layer is already attached
to the scene. The importer reuses such assets from the previous storyboard when character IDs
match; it does not invent or generate missing character art/rig parts. Other imported poses,
props, and effects remain prompts until a renderer/provider supports them. The import diagnostics
warn when a token is outside the adapter's declared compatibility set.

## Use in DRAVEX

In the main story panel, choose the What-if Kit `episode.json` file in the
"Импорт What-if эпизода / Import What-if episode" control. Files larger than 5 MB are rejected.
The selected hero ID is mapped to the current DRAVEX main character; other actor IDs remain
available as cast metadata. Matching existing rig/sprite assets are reused when available; otherwise
the corresponding character still needs a generated/attached DRAVEX asset before it can be animated.

The importer inspects `diagnostics.ok/errors/warnings`, creates editable DRAVEX scenes, refreshes
the scene preview/editor, and runs the normal DRAVEX story QA. The same adapter can also be called
programmatically with `convertWhatIfEpisode(episodeJson, { characterMap })`.

Imported narration is retained as source-story text; it is **not** silently marked as synthesized
voice. Generate/validate speech through DRAVEX's existing voice workflow, then generate scene
images/video with the configured provider and export through DRAVEX. Do not bypass those gates or
mark a film complete before a playable export exists.

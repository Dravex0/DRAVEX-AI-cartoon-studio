# Video generation provider contract

DRAVEX uses a provider-neutral contract for optional video-generation engines.

- The editor and storyboard remain usable when no video provider is configured.
- Providers register explicitly and declare supported task types.
- Requests are validated before a provider is called (prompt, source media, duration and FPS).
- Providers may return queued/processing/pending jobs or a completed Blob/URL.
- Cancellation is forwarded as an AbortSignal-like context.
- Provider keys and network calls are owned by the provider adapter, never hard-coded into the editor.
- This contract does not bundle a model, create a hosted endpoint, or make generation free by itself.

The first adapter should be selected only after its actual hosting cost, model licence, hardware requirements, CORS behavior and privacy implications are verified. Local inference and optional user-configured hosted inference must remain separate choices.

const VIDEO_MODES = new Set(['huggingface', 'comfyui', 'local-canvas']);

const count = value => Number.isFinite(Number(value))
  ? Math.max(0, Math.floor(Number(value)))
  : 0;

/**
 * Check the explicit prerequisites for the one-click prompt-to-film action.
 * This module does not grant consent, select providers, or start network work.
 */
export function evaluatePromptToFilmStart({
  mode,
  sceneCount,
  videoProviderReady = false,
  remoteVideoConsent = false,
  missingImageCount = 0,
  imagePromptConsent = false,
  running = false
} = {}) {
  const blockers = [];
  const scenes = count(sceneCount);
  const missingImages = count(missingImageCount);
  const selectedMode = String(mode || '').trim().toLowerCase();

  if (running) blockers.push('generation-already-running');
  if (!scenes) blockers.push('storyboard-required');
  if (!VIDEO_MODES.has(selectedMode)) blockers.push('video-mode-invalid');
  if (selectedMode === 'huggingface' && remoteVideoConsent !== true) {
    blockers.push('remote-video-consent-required');
  }
  if (selectedMode !== 'local-canvas' && videoProviderReady !== true) blockers.push('video-provider-not-ready');
  if (selectedMode === 'huggingface' && missingImages > 0 && imagePromptConsent !== true) {
    blockers.push('image-prompt-consent-required');
  }

  return {
    ok: blockers.length === 0,
    status: blockers.length ? 'blocked' : 'ready',
    blockers,
    sceneCount: scenes,
    missingImageCount: missingImages,
    mode: selectedMode || null
  };
}

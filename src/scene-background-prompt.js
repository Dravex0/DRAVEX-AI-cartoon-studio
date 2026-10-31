const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);

/**
 * Build an environment-only still-image prompt.
 *
 * Character Bible, cast, story action, dialogue, and existing character-aware
 * image prompts are intentionally not accepted as inputs. This is a prompt
 * separation boundary, not proof that an image model will obey the request.
 */
export function buildSceneBackgroundPrompt(scene = {}) {
  const environment = [
    ['Environment description', clean(scene.environmentDescription, 2000)],
    ['Location', clean(scene.location, 500)],
    ['Time of day', clean(scene.timeOfDay, 120)],
    ['Weather', clean(scene.weather, 200)],
    ['Lighting', clean(scene.environmentLighting, 300)],
    ['Environment style', clean(scene.environmentStyle, 300)]
  ].filter(([, value]) => value);

  if (!environment.length) {
    return {
      ready: false,
      prompt: '',
      compositionStatus: 'unverified',
      issues: [{ code: 'missing-environment-description' }]
    };
  }

  const prompt = [
    'Create one coherent environment-only background plate for a 2D/2.5D animated cartoon scene.',
    ...environment.map(([label, value]) => label + ': ' + value),
    'Show only the environment and non-character scenery. Do not render people, characters, animals, creatures, figures, silhouettes, portraits, character-shaped shadows, or foreground subjects.',
    'Keep clear usable foreground space for separately composited character sprites. Do not add text, captions, logos, or watermarks.'
  ].join('\n\n');

  return {
    ready: true,
    prompt,
    assetRole: 'scene-background',
    compositionStatus: 'unverified',
    excludedInputs: [
      'characters',
      'characterBible',
      'visibleAction',
      'actionTimeline',
      'dialogue',
      'storyDetail',
      'imagePrompt',
      'prompt',
      'description',
      'camera',
      'continuityLock'
    ],
    issues: []
  };
}

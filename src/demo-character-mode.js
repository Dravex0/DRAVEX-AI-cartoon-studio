/** Decide when the built-in procedural character should stand in for missing art. */
export function shouldShowProceduralDemoCharacter({ storyUsesFallback = false, hasCharacterLayers = false } = {}) {
  return storyUsesFallback === true && hasCharacterLayers !== true;
}

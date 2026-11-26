/**
 * Seed deterministic, transparent character layers for mocked-provider E2E tests.
 * These are test fixtures, not AI-generated assets or proof of model quality.
 */
export async function seedCharacterLayersForCurrentDraft(page) {
  await page.locator('#save').click();
  const fixture = await page.evaluate(() => {
    const key = 'dravex-cartoon-draft';
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error('Could not read the saved DRAVEX draft for character fixture setup.');
    const draft = JSON.parse(raw);
    const scenes = Array.isArray(draft.sceneMetadata) ? draft.sceneMetadata : [];
    if (!scenes.length) throw new Error('Create a storyboard before seeding character fixture layers.');

    const firstStoryCharacter = scenes
      .flatMap(scene => Array.isArray(scene?.characters) ? scene.characters : [])
      .map(value => String(value || '').trim())
      .find(Boolean);
    const fallbackCharacter = String(
      draft.character || draft.characterBible?.[0]?.characterId || firstStoryCharacter || 'E2E Test Character'
    ).trim();

    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = 64;
    spriteCanvas.height = 96;
    const context = spriteCanvas.getContext('2d');
    if (!context) throw new Error('Could not create the transparent E2E character sprite.');
    context.fillStyle = '#ff2d95';
    context.beginPath();
    context.arc(32, 17, 12, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#00e5ff';
    context.fillRect(19, 31, 26, 39);
    context.fillRect(11, 35, 9, 28);
    context.fillRect(44, 35, 9, 28);
    context.fillRect(21, 68, 9, 24);
    context.fillRect(34, 68, 9, 24);
    const spriteUrl = spriteCanvas.toDataURL('image/png');

    let layerCount = 0;
    const characterIds = new Set();
    draft.character = draft.character || fallbackCharacter;
    draft.sceneMetadata = scenes.map(scene => {
      const cast = Array.isArray(scene?.characters)
        ? [...new Set(scene.characters.map(value => String(value || '').trim()).filter(Boolean))]
        : [];
      const required = cast.length ? cast : [fallbackCharacter];
      const characterLayers = required.map((characterId, index) => {
        characterIds.add(characterId);
        layerCount += 1;
        return {
          characterId,
          imageUrl: spriteUrl,
          x: Math.min(0.72 + index * 0.09, 0.9),
          y: 0.68,
          width: 0.09,
          height: 0.28,
          rotation: 0,
          scale: 1,
          opacity: 1,
          zIndex: index,
          visible: true
        };
      });
      return { ...scene, characters: required, characterLayers };
    });
    localStorage.setItem(key, JSON.stringify(draft));
    return {
      sceneCount: draft.sceneMetadata.length,
      characterLayerCount: layerCount,
      characterIds: [...characterIds],
      fixtureType: 'transparent-deterministic-test-sprite'
    };
  });

  await page.reload();
  await page.waitForFunction(
    sceneCount => document.querySelectorAll('#scenes button.scene').length === sceneCount,
    fixture.sceneCount
  );
  return fixture;
}

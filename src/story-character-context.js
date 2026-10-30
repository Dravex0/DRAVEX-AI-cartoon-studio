import { mergeCharacterReferences } from './character-reference.js';
import { inferSceneCast } from './scene-cast-inference.js';
import { inferCharacterInteraction } from './character-interaction.js';

/**
 * Prepare the character library and scene cast from a deterministic story plan.
 * Character matching is lexical and source-grounded; it does not claim visual
 * recognition or infer relationships that are not explicit in the scene text.
 */
export function prepareStoryCharacterContext(plan = {}, existingCharacterBible = [], protagonist = '', language = 'en') {
  const discoveredProfiles = Array.isArray(plan?.brief?.characterProfiles)
    ? plan.brief.characterProfiles
    : [];
  const protagonistId = String(protagonist ?? '').trim().slice(0, 120);
  const additions = protagonistId
    ? [...discoveredProfiles, { characterId: protagonistId }]
    : discoveredProfiles;
  const characterBible = mergeCharacterReferences(existingCharacterBible, additions);
  const knownCharacterIds = characterBible.map(profile => profile.characterId);
  const sourceScenes = Array.isArray(plan?.scenes) ? plan.scenes : [];

  const scenes = sourceScenes.map(scene => {
    const storyDetail = String(scene?.storyDetail ?? '');
    const characters = inferSceneCast(storyDetail, knownCharacterIds, protagonistId);
    return {
      ...scene,
      characters,
      interaction: inferCharacterInteraction(storyDetail, characters, language)
    };
  });

  return { characterBible, scenes };
}

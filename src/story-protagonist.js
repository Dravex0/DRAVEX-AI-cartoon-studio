import { parseStoryBrief } from './story-brief.js';

const FALLBACK_PROTAGONIST = {
  ru: 'Главный герой',
  uk: 'Головний герой',
  en: 'Main character',
  es: 'Personaje principal'
};

/**
 * Resolve the story's protagonist without injecting a demo character.
 * An explicit UI choice wins; otherwise use the first source-declared character.
 */
export function resolveStoryProtagonist(storyText, selectedCharacter = '', language = 'en') {
  const selected = String(selectedCharacter ?? '').trim().slice(0, 120);
  if (selected) return selected;

  const brief = parseStoryBrief(storyText);
  const declared = Array.isArray(brief.characters) ? brief.characters[0] : '';
  const profile = Array.isArray(brief.characterProfiles)
    ? brief.characterProfiles[0]?.characterId
    : '';
  const inferred = String(declared || profile || '').trim().slice(0, 120);
  if (inferred) return inferred;

  return FALLBACK_PROTAGONIST[language] || FALLBACK_PROTAGONIST.en;
}

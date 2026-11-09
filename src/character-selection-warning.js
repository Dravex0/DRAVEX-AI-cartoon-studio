/**
 * Returns a non-blocking warning when an explicitly selected protagonist name
 * does not appear in the source story. The selection is never changed here.
 */
export function getCharacterSelectionWarning(storyText, selectedCharacter) {
  const selected = String(selectedCharacter ?? '').trim().slice(0, 120);
  const source = String(storyText ?? '').normalize('NFKC').toLocaleLowerCase();
  if (!selected || !source.trim()) return null;

  const escaped = selected.normalize('NFKC').toLocaleLowerCase()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const namePattern = new RegExp('(^|[^\\p{L}\\p{N}_])' + escaped + '($|[^\\p{L}\\p{N}_])', 'iu');
  if (namePattern.test(source)) return null;

  return {
    code: 'selected-character-not-mentioned',
    selectedCharacter: selected,
    message: 'The selected protagonist name does not appear in the source story.'
  };
}

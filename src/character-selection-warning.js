/**
 * Returns a non-blocking warning when an explicitly selected protagonist name
 * does not appear in the source story. The selection is never changed here.
 */
export function getCharacterSelectionWarning(storyText, selectedCharacter) {
  const selected = String(selectedCharacter ?? '').normalize('NFKC').trim().slice(0, 120);
  const source = String(storyText ?? '').normalize('NFKC');
  if (!selected || !source.trim()) return null;

  const tokenize = value => value.toLocaleLowerCase().match(/[\\p{L}\\p{N}_]+/gu) || [];
  const selectedTokens = tokenize(selected);
  const sourceTokens = tokenize(source);
  if (!selectedTokens.length) return null;

  const appearsInStory = sourceTokens.some((_, index) =>
    selectedTokens.every((token, offset) => sourceTokens[index + offset] === token)
  );
  if (appearsInStory) return null;

  return {
    code: 'selected-character-not-mentioned',
    selectedCharacter: selected,
    message: 'The selected protagonist name does not appear in the source story.'
  };
}

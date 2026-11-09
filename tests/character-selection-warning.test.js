import test from 'node:test';
import assert from 'node:assert/strict';
import { getCharacterSelectionWarning } from '../src/character-selection-warning.js';

test('does not warn when the selected character name appears in the story', () => {
  assert.equal(getCharacterSelectionWarning('Каэль спасает город.', 'Каэль'), null);
  assert.equal(getCharacterSelectionWarning('Foxy finds a key.', 'foxy'), null);
});

test('warns without changing the selection when its name is absent', () => {
  const warning = getCharacterSelectionWarning('Каэль спасает город от чудовища.', 'Foxy');
  assert.equal(warning.code, 'selected-character-not-mentioned');
  assert.equal(warning.selectedCharacter, 'Foxy');
});

test('matches multi-word names as complete token sequences', () => {
  assert.equal(getCharacterSelectionWarning('The little fox returns home.', 'little fox'), null);
  assert.equal(getCharacterSelectionWarning('The little fox returns home.', 'fox hero'), null);
});

test('does not warn when no character is explicitly selected or story is empty', () => {
  assert.equal(getCharacterSelectionWarning('A hero arrives.', ''), null);
  assert.equal(getCharacterSelectionWarning('', 'Foxy'), null);
});

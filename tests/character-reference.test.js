import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCharacterReference, upsertCharacterReference, CHARACTER_REFERENCE_LIMIT } from '../src/character-reference.js';

test('normalizes and bounds every visual identity field', () => {
  const result = normalizeCharacterReference({
    characterId: ' Foxy ',
    visualDescription: 'A small orange fox'.repeat(100),
    clothing: 'Blue scarf',
    colors: 'Orange and blue',
    distinctiveFeatures: 'White tail tip'
  });
  assert.equal(result.characterId, 'Foxy');
  assert.equal(result.visualDescription.length, 1200);
  assert.equal(result.clothing, 'Blue scarf');
});

test('adds a profile and updates it case-insensitively without duplicates', () => {
  const first = upsertCharacterReference([], { characterId: 'Foxy', clothing: 'Blue scarf' });
  const updated = upsertCharacterReference(first, { characterId: 'foxy', clothing: 'Green jacket' });
  assert.equal(updated.length, 1);
  assert.equal(updated[0].clothing, 'Green jacket');
});

test('rejects an empty identity and enforces the profile limit', () => {
  assert.throws(() => upsertCharacterReference([], { clothing: 'Cape' }), /name or ID/);
  const full = Array.from({ length: CHARACTER_REFERENCE_LIMIT }, (_, index) => ({ characterId: 'character-' + index }));
  assert.throws(() => upsertCharacterReference(full, { characterId: 'extra' }), /limit reached/);
});

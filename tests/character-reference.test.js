import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCharacterReference, upsertCharacterReference, mergeCharacterReferences, CHARACTER_REFERENCE_LIMIT } from '../src/character-reference.js';

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


test('merges story-extracted profiles without overwriting manually edited references', () => {
  const merged = mergeCharacterReferences(
    [{ characterId: 'Foxy', visualDescription: 'User-approved orange fox', clothing: 'Custom blue scarf' }],
    [
      { characterId: 'foxy', visualDescription: 'Automatically inferred fox' },
      { characterId: 'Snowball', visualDescription: 'White rabbit with long ears' }
    ]
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].visualDescription, 'User-approved orange fox');
  assert.equal(merged[0].clothing, 'Custom blue scarf');
  assert.equal(merged[1].characterId, 'Snowball');
});

test('merges only valid unique profiles and respects the character library limit', () => {
  const existing = Array.from({ length: CHARACTER_REFERENCE_LIMIT - 1 }, (_, index) => ({
    characterId: 'existing-' + index
  }));
  const merged = mergeCharacterReferences(existing, [
    { characterId: 'existing-0', visualDescription: 'Duplicate' },
    { characterId: 'new-one', visualDescription: 'First new character' },
    { characterId: 'new-two', visualDescription: 'Must be capped' },
    { visualDescription: 'Missing ID' }
  ]);
  assert.equal(merged.length, CHARACTER_REFERENCE_LIMIT);
  assert.equal(merged.at(-1).characterId, 'new-one');
});


test('normalizes optional identity anchors and bounds their length', () => {
  const result = normalizeCharacterReference({
    characterId: 'Foxy',
    species: 'Anthropomorphic fox',
    ageRange: 'Young adult',
    bodyShape: 'Small and agile',
    hair: 'Short swept-back auburn hair',
    eyeColor: 'Amber',
    silhouette: 'Large ears and bushy tail',
    signatureAccessories: 'Blue scarf and brass pendant'.repeat(20)
  });
  assert.equal(result.species, 'Anthropomorphic fox');
  assert.equal(result.ageRange, 'Young adult');
  assert.equal(result.bodyShape, 'Small and agile');
  assert.equal(result.hair, 'Short swept-back auburn hair');
  assert.equal(result.eyeColor, 'Amber');
  assert.equal(result.silhouette, 'Large ears and bushy tail');
  assert.equal(result.signatureAccessories.length, 300);
});

test('legacy character profiles receive empty defaults for new identity anchors', () => {
  const result = normalizeCharacterReference({
    characterId: 'Foxy',
    visualDescription: 'Small orange fox',
    clothing: 'Blue scarf'
  });
  for (const field of ['species', 'ageRange', 'bodyShape', 'hair', 'eyeColor', 'silhouette', 'signatureAccessories']) {
    assert.equal(result[field], '');
  }
});

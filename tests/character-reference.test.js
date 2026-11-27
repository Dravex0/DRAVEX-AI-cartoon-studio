import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCharacterReference, upsertCharacterReference, mergeCharacterReferences, selectCharacterReferencesForScene, CHARACTER_REFERENCE_LIMIT, CHARACTER_REFERENCE_IMAGE_LIMIT } from '../src/character-reference.js';

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


test('preserves a local reference image asset ID without embedding image data', () => {
  const result = normalizeCharacterReference({
    characterId: 'Foxy',
    referenceImageAssetId: 'refimg_12345678',
    referenceImage: new Blob(['should-not-be-stored'])
  });
  assert.equal(result.referenceImageAssetId, 'refimg_12345678');
  assert.equal(Object.hasOwn(result, 'referenceImage'), false);
});


test('routes only the reference profiles explicitly present in a scene cast', () => {
  const profiles = [
    { characterId: 'Foxy', referenceImageAssetId: 'fox-image' },
    { characterId: 'Mira', referenceImageAssetId: 'mira-image' },
    { characterId: 'Snowball', referenceImageAssetId: 'snow-image' }
  ];
  const selected = selectCharacterReferencesForScene(profiles, ['mIrA', 'Foxy']);
  assert.deepEqual(selected.map(profile => profile.characterId), ['Mira', 'Foxy']);
  assert.deepEqual(selected.map(profile => profile.referenceImageAssetId), ['mira-image', 'fox-image']);
});

test('keeps image slots in scene-cast order and uses only the first saved image for each character', () => {
  const profiles = [
    { characterId: 'Foxy', referenceImageAssetId: 'fox-first-image' },
    { characterId: 'foxy', referenceImageAssetId: 'fox-duplicate-image' },
    { characterId: 'Mira' },
    { characterId: 'Snowball', referenceImageAssetId: 'snow-image' }
  ];
  const selected = selectCharacterReferencesForScene(profiles, ['Snowball', 'Foxy', 'Mira', 'FOXy']);

  assert.deepEqual(selected.map(profile => profile.characterId), ['Snowball', 'Foxy']);
  assert.deepEqual(selected.map(profile => profile.referenceImageAssetId), ['snow-image', 'fox-first-image']);
});

test('does not leak character references into scenes with an empty or unrelated cast', () => {
  const profiles = [
    { characterId: 'Foxy', referenceImageAssetId: 'fox-image' },
    { characterId: 'Mira', referenceImageAssetId: 'mira-image' }
  ];
  assert.deepEqual(selectCharacterReferencesForScene(profiles, []), []);
  assert.deepEqual(selectCharacterReferencesForScene(profiles, ['Unknown character']), []);
});

test('returns every saved scene-specific image reference so the provider can report capacity overflow', () => {
  const profiles = ['Foxy', 'Mira', 'Snowball', 'Robot', 'Bird'].map(characterId => ({
    characterId,
    referenceImageAssetId: characterId.toLowerCase() + '-image'
  }));
  assert.equal(CHARACTER_REFERENCE_IMAGE_LIMIT, 4);
  assert.deepEqual(
    selectCharacterReferencesForScene(profiles, ['Foxy', 'Mira', 'Snowball', 'Robot', 'Bird']).map(profile => profile.characterId),
    ['Foxy', 'Mira', 'Snowball', 'Robot', 'Bird']
  );
});

test('skips cast profiles without saved images and fills later available reference slots', () => {
  const profiles = [
    { characterId: 'Foxy' },
    { characterId: 'Mira', referenceImageAssetId: 'mira-image' },
    { characterId: 'Snowball', referenceImageAssetId: 'snow-image' },
    { characterId: 'Robot', referenceImageAssetId: 'robot-image' },
    { characterId: 'Bird', referenceImageAssetId: 'bird-image' },
    { characterId: 'Wolf', referenceImageAssetId: 'wolf-image' }
  ];
  assert.deepEqual(
    selectCharacterReferencesForScene(profiles, ['Foxy', 'Mira', 'Snowball', 'Robot', 'Bird', 'Wolf']).map(profile => profile.characterId),
    ['Mira', 'Snowball', 'Robot', 'Bird', 'Wolf']
  );
});

test('fills empty placeholder fields from story extraction without replacing saved character details', () => {
  const merged = mergeCharacterReferences(
    [{ characterId: 'Foxy', clothing: 'User-approved blue scarf' }],
    [{
      characterId: 'foxy',
      visualDescription: 'Small orange fox with amber eyes',
      clothing: 'Automatically inferred green jacket',
      colors: 'Orange and cream',
      distinctiveFeatures: 'White tail tip'
    }]
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].characterId, 'Foxy');
  assert.equal(merged[0].visualDescription, 'Small orange fox with amber eyes');
  assert.equal(merged[0].clothing, 'User-approved blue scarf');
  assert.equal(merged[0].colors, 'Orange and cream');
  assert.equal(merged[0].distinctiveFeatures, 'White tail tip');
});

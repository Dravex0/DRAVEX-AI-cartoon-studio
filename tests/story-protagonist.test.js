import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStoryProtagonist } from '../src/story-protagonist.js';

test('an explicit main-character choice takes priority over story extraction', () => {
  assert.equal(resolveStoryProtagonist('Main character: Arin', 'Foxy', 'en'), 'Foxy');
});

test('uses the first declared character profile instead of a demo character', () => {
  const story = [
    'THE LAST GUARDIAN OF THE STARS',
    'Characters:',
    'Arin — 17-year-old guardian with black hair and blue energy.',
    'Elira — 17-year-old mage with silver hair.',
    'Nox — antagonist in black armor.',
    'Scene 1: The Falling Stars',
    'Arin stands on a rooftop beneath falling stars.'
  ].join('\n');
  assert.equal(resolveStoryProtagonist(story, '', 'en'), 'Arin');
});

test('uses an explicitly labeled protagonist when no profile block exists', () => {
  assert.equal(resolveStoryProtagonist('Main character: Elira\nElira raises a light barrier.', '', 'en'), 'Elira');
});

test('does not inject Foxy when the story has no declared character', () => {
  assert.equal(resolveStoryProtagonist('A storm approaches an empty castle.', '', 'en'), 'Main character');
  assert.equal(resolveStoryProtagonist('Гроза приближается к замку.', '', 'ru'), 'Главный герой');
});

test('recognizes natural-language named protagonists', () => {
  assert.equal(resolveStoryProtagonist('A young mage named Arin discovers a blue crystal.', '', 'en'), 'Arin');
});

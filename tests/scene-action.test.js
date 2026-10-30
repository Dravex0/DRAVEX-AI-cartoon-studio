import test from 'node:test';
import assert from 'node:assert/strict';
import { detectSceneAction } from '../src/scene-action.js';

const cases = [
  ['Лисёнок исчезает за деревом', 'vanish'],
  ['The fox leaps over a fallen branch', 'jump'],
  ['Герой убегает от грозы', 'run'],
  ['The character dances and twirls', 'dance'],
  ['Лисёнок медленно шагает к двери', 'walk'],
  ['A bird hovers above the lake', 'float'],
  ['Волшебный ключ ярко сияет', 'magic'],
  ['The child gasps, wide-eyed', 'surprised'],
  ['Персонаж испугался и заплакал', 'sad'],
  ['The fox smiles happily', 'happy'],
  ['Герой шепчет другу', 'talk'],
  ['Лисёнок оборачивается назад', 'turn']
];

for (const [description, expected] of cases) {
  test(`detects ${expected} action: ${description}`, () => {
    assert.equal(detectSceneAction(description), expected);
  });
}

test('uses a stable idle fallback for empty or unrecognized text', () => {
  assert.equal(detectSceneAction(''), 'idle');
  assert.equal(detectSceneAction('A fox is beside a tree.'), 'idle');
});

test('action detection is case-insensitive and safe for unusual input', () => {
  assert.equal(detectSceneAction('THE FOX RUNS'), 'run');
  assert.equal(detectSceneAction(null), 'idle');
  assert.equal(detectSceneAction({ toString: () => 'El personaje baila' }), 'dance');
});

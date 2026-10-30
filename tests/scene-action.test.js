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

test('character expression takes priority over a glowing prop', () => {
  assert.equal(detectSceneAction('The fox smiles at the glowing star'), 'happy');
  assert.equal(detectSceneAction('Лисёнок улыбается светящейся звезде'), 'happy');
});

test('spoken action takes priority over magical scene vocabulary', () => {
  assert.equal(detectSceneAction('The fox whispers about a magical glowing star'), 'talk');
  assert.equal(detectSceneAction('Лисёнок шепчет о волшебной светящейся звезде'), 'talk');
});

test('magic remains detectable when no stronger character action is present', () => {
  assert.equal(detectSceneAction('A magical star glows above the forest'), 'magic');
  assert.equal(detectSceneAction('Волшебная звезда сияет над лесом'), 'magic');
});
test('explicit turning movement takes priority over glowing background details', () => {
  assert.equal(detectSceneAction('The fox turns toward the glowing light'), 'turn');
  assert.equal(detectSceneAction('Лисёнок поворачивается к сияющему свету'), 'turn');
});


test('uses the selected scene motion prompt before fallback description text', async () => {
  const { detectSceneActionForScene } = await import('../src/scene-action.js');
  assert.equal(detectSceneActionForScene({
    motionPrompt: 'The fox jumps over the river.',
    description: 'The fox waits beside a tree.'
  }), 'jump');
});

test('uses visible action when no motion prompt is supplied', async () => {
  const { detectSceneActionForScene } = await import('../src/scene-action.js');
  assert.equal(detectSceneActionForScene({
    visibleAction: 'Лисёнок медленно шагает к двери.'
  }), 'walk');
});

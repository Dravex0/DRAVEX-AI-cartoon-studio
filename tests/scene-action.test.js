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


test('does not let fallback description override an explicit motion prompt', async () => {
  const { detectSceneActionForScene } = await import('../src/scene-action.js');
  assert.equal(detectSceneActionForScene({
    motionPrompt: 'The fox walks slowly toward the gate.',
    description: 'The fox runs through the forest.'
  }), 'walk');
});


test('classifies combined character powers as team magic, not jumping', async () => {
  const { inferSceneActionIntent } = await import('../src/scene-action.js');
  const result = inferSceneActionIntent('Arin and Elira unite their powers and combine blue energy with light magic.');
  assert.equal(result.intent, 'team_magic');
  assert.equal(result.motionCue, 'magic');
  assert.equal(result.confidence, 0.9);
});

test('classifies an energy collision as a distinct battle event', async () => {
  const { inferSceneActionIntent } = await import('../src/scene-action.js');
  const result = inferSceneActionIntent('Their blue and dark energy collide in a powerful clash.');
  assert.equal(result.intent, 'energy_clash');
  assert.equal(result.motionCue, 'magic');
});

test('distinguishes defense, evasion, attack, awakening, reveal and warning', async () => {
  const { inferSceneActionIntent } = await import('../src/scene-action.js');
  const examples = [
    ['Nox blocks the blue blade with his armor.', 'defend'],
    ['Arin dodges the incoming strike.', 'dodge'],
    ['Arin attacks with an energy blade.', 'attack'],
    ['Blue energy awakens around Arin’s hand.', 'power_up'],
    ['Nox appears among the ruins.', 'reveal'],
    ['Elira warns Arin about the ancient darkness.', 'warning']
  ];
  for (const [story, expected] of examples) {
    assert.equal(inferSceneActionIntent(story).intent, expected, story);
  }
});

test('supports Russian and Ukrainian semantic scene actions', async () => {
  const { inferSceneActionIntent } = await import('../src/scene-action.js');
  assert.equal(inferSceneActionIntent('Арин и Элира объединяют свои силы и магию.').intent, 'team_magic');
  assert.equal(inferSceneActionIntent('Нокс появляется среди руин.').intent, 'reveal');
  assert.equal(inferSceneActionIntent('Арін та Еліра поєднують свої сили й енергію.').intent, 'team_magic');
  assert.equal(inferSceneActionIntent('Нокс з’являється серед руїн.').intent, 'reveal');
});

test('keeps semantic labels separate from supported renderer movement cues', async () => {
  const { inferSceneActionIntent } = await import('../src/scene-action.js');
  const result = inferSceneActionIntent('Arin and Elira combine their powers.');
  assert.ok(['idle', 'walk', 'run', 'jump', 'turn', 'float', 'vanish', 'magic', 'talk', 'surprised', 'sad', 'happy', 'dance'].includes(result.motionCue));
});


test('ignores explicitly negated actions in four supported languages', () => {
  const examples = [
    ['The fox does not run through the forest.', 'idle'],
    ["The fox isn't running.", 'idle'],
    ['Лисёнок не бежит по лесу.', 'idle'],
    ['Лисеня не стрибає через струмок.', 'idle'],
    ['El zorro no corre por el bosque.', 'idle']
  ];
  for (const [description, expected] of examples) {
    assert.equal(detectSceneAction(description), expected, description);
  }
});

test('keeps a positive action after a contrastive negated action', () => {
  assert.equal(detectSceneAction('The fox does not walk, but runs toward the gate.'), 'run');
  assert.equal(detectSceneAction('Лис не бежит, а идёт к воротам.'), 'walk');
});

test('does not mistake the phrase not only for negation', () => {
  assert.equal(detectSceneAction('The fox not only runs but also jumps.'), 'jump');
});

test('does not infer negated semantic events as positive intent', async () => {
  const { inferSceneActionIntent } = await import('../src/scene-action.js');
  assert.notEqual(inferSceneActionIntent('Arin does not attack Nox.').intent, 'attack');
  assert.notEqual(inferSceneActionIntent('Арин не атакует Нокса.').intent, 'attack');
  assert.equal(inferSceneActionIntent('Arin does not defend; he attacks instead.').intent, 'attack');
});

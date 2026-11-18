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


test('ignores explicitly negated actions in English, Russian, Ukrainian and Spanish', () => {
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

test('preserves positive actions after contrastive negation', () => {
  assert.equal(detectSceneAction('The fox does not walk, but runs toward the gate.'), 'run');
  assert.equal(detectSceneAction('Лис не бежит, а идёт к воротам.'), 'walk');
});

test('does not mistake "not only" for a negated action', () => {
  assert.equal(detectSceneAction('The fox not only runs but also jumps.'), 'jump');
});

test('continues scanning when an earlier occurrence is negated but a later one is positive', () => {
  assert.equal(detectSceneAction('The fox does not run; later it runs toward the gate.'), 'run');
});

test('does not infer negated semantic events as positive intent', async () => {
  const { inferSceneActionIntent } = await import('../src/scene-action.js');
  assert.notEqual(inferSceneActionIntent('Arin does not attack Nox.').intent, 'attack');
  assert.notEqual(inferSceneActionIntent('Арин не атакует Нокса.').intent, 'attack');
  assert.equal(inferSceneActionIntent('Arin does not defend; he attacks instead.').intent, 'attack');
});

test('prefers the source-grounded semantic event over later incidental actions in the story detail', async () => {
  const { detectSceneActionForScene } = await import('../src/scene-action.js');
  assert.equal(detectSceneActionForScene({
    semanticActionIntent: { intent: 'reveal', motionCue: 'surprised' },
    storyDetail: 'Огромный портал открывается, из него появляется теневая сущность. Позже портал исчезает.'
  }), 'surprised');
  assert.equal(detectSceneActionForScene({
    semanticActionIntent: { intent: 'power_up', motionCue: 'magic' },
    storyDetail: 'Жители внизу убегают, а вокруг героя пробуждается голубая энергия.'
  }), 'magic');
  assert.equal(detectSceneActionForScene({
    semanticActionIntent: { intent: 'dodge', motionCue: 'jump' },
    storyDetail: 'Герой уклоняется от луча и создаёт энергетический щит.'
  }), 'jump');
});


test('recognizes concrete object interactions and physical actions in four languages', async () => {
  const { inferSceneActionIntent } = await import('../src/scene-action.js');
  const cases = [
    ['The girl picks up the glowing key.', 'pick_up'],
    ['The boy throws the ball across the yard.', 'throw'],
    ['The fox catches the falling apple.', 'catch'],
    ['The knight opens the heavy gate.', 'open'],
    ['The robot closes the metal door.', 'close'],
    ['The child climbs the old tower.', 'climb'],
    ['The mermaid swims beneath the bridge.', 'swim'],
    ['The dragon falls from the cliff.', 'fall'],
    ['The bird lands on the branch.', 'land'],
    ['The friends hug each other.', 'hug'],
    ['The wizard sits beside the fire.', 'sit'],
    ['The puppy crawls under the table.', 'crawl'],
    ['The girl drinks from a cup.', 'eat_drink'],
    ['The hero wakes up at sunrise.', 'sleep_wake'],
    ['The captain points toward the island.', 'point'],
    ['The child draws a map.', 'write_draw'],
    ['Девочка поднимает светящийся ключ.', 'pick_up'],
    ['Мальчик бросает мяч через двор.', 'throw'],
    ['Рыцарь открывает тяжёлые ворота.', 'open'],
    ['Русалка плывёт под мостом.', 'swim'],
    ['Дракон падает со скалы.', 'fall'],
    ['Друзья обнимаются.', 'hug'],
    ['Дитина малює карту.', 'write_draw']
  ];
  for (const [story, expected] of cases) {
    assert.equal(inferSceneActionIntent(story).intent, expected, story);
  }
});

test('does not classify explicitly negated object interactions as positive actions', async () => {
  const { inferSceneActionIntent } = await import('../src/scene-action.js');
  assert.notEqual(inferSceneActionIntent('The knight does not open the gate.').intent, 'open');
  assert.notEqual(inferSceneActionIntent('Рыцарь не открывает ворота.').intent, 'open');
  assert.equal(inferSceneActionIntent('The knight does not open the gate, but throws a stone.').intent, 'throw');
});

test('maps new semantic actions only to existing renderer motion cues', async () => {
  const { inferSceneActionIntent } = await import('../src/scene-action.js');
  const supported = new Set(['idle', 'walk', 'run', 'jump', 'turn', 'float', 'vanish', 'magic', 'talk', 'surprised', 'sad', 'happy', 'dance']);
  for (const story of ['The girl picks up a key.', 'The dragon falls from a cliff.', 'The friends hug.', 'The child draws a map.']) {
    assert.ok(supported.has(inferSceneActionIntent(story).motionCue));
  }
});


test('extracts ordered action sequences without inventing negated or connective actions', async () => {
  const { extractSceneActionSequence } = await import('../src/scene-action.js');
  const sequence = extractSceneActionSequence(
    'The girl walks to the table, picks up a key, opens the chest, then throws the key away.'
  );
  assert.deepEqual(sequence.map(event => event.intent), ['walk', 'pick_up', 'open', 'throw'], JSON.stringify(sequence));
  assert.ok(sequence.every(event => event.evidence && event.endIndex > event.startIndex));
  const negated = extractSceneActionSequence('The knight does not open the gate, but catches the falling key.');
  assert.deepEqual(negated.map(event => event.intent), ['catch']);
});

test('extracts Russian and Ukrainian multi-action sequences in source order', async () => {
  const { extractSceneActionSequence } = await import('../src/scene-action.js');
  assert.deepEqual(
    extractSceneActionSequence('Лисёнок подходит к двери, открывает её и подбирает ключ.').map(event => event.intent),
    ['walk', 'open', 'pick_up']
  );
  assert.deepEqual(
    extractSceneActionSequence('Дитина підходить до столу, підбирає олівець і малює карту.').map(event => event.intent),
    ['walk', 'pick_up', 'write_draw']
  );
});

test('bounds extracted scene action sequences to eight events', async () => {
  const { extractSceneActionSequence } = await import('../src/scene-action.js');
  const sequence = extractSceneActionSequence(
    'walks, jumps, runs, dances, turns, floats, waves, talks, then vanishes',
    { maxActions: 8 }
  );
  assert.equal(sequence.length, 8);
});


test('does not confuse the English word girl with the Spanish turn verb', async () => {
  const { extractSceneActionSequence } = await import('../src/scene-action.js');
  assert.deepEqual(
    extractSceneActionSequence('A girl walks to the table.').map(event => event.intent),
    ['walk']
  );
});


test('understands a complete Russian tactical story sequence with sensory cues and intent', async () => {
  const { extractSceneActionSequence } = await import('../src/scene-action.js');
  const story = 'Полицейский заходит в здание, слышит крики, достаёт пистолет, идёт медленно и тихо, прислушивается, идёт дальше, видит как избивают человека, выпрыгивает, наставляет пистолет и кричит: «Руки вверх!»';
  const sequence = extractSceneActionSequence(story);
  assert.deepEqual(sequence.map(event => event.intent), [
    'enter_location', 'hear_sound', 'draw_weapon', 'stealth_advance',
    'listen_carefully', 'advance', 'discover_threat', 'intervene', 'aim_weapon', 'shout_command'
  ], JSON.stringify(sequence));
  assert.ok(sequence.every(event => story.slice(event.startIndex, event.endIndex) === event.evidence));
});

test('understands equivalent English sensory, stealth and intervention beats', async () => {
  const { extractSceneActionSequence } = await import('../src/scene-action.js');
  const story = 'The officer enters the building, hears screams, draws his pistol, moves slowly and quietly, pauses to listen carefully, advances further, sees an attacker beating a person, bursts out, aims his pistol at him and shouts "Hands up!"';
  const sequence = extractSceneActionSequence(story);
  assert.deepEqual(sequence.map(event => event.intent), [
    'enter_location', 'hear_sound', 'draw_weapon', 'stealth_advance',
    'listen_carefully', 'advance', 'discover_threat', 'intervene', 'aim_weapon', 'shout_command'
  ], JSON.stringify(sequence));
});


test('recognizes tactical reactions and resolution events in multiple languages', async () => {
  const { extractSceneActionSequence } = await import('../src/scene-action.js');
  const russian = 'Полицейский замирает, прячется за стену, вызывает подкрепление, затем опускает пистолет.';
  assert.deepEqual(
    extractSceneActionSequence(russian).map(event => event.intent),
    ['freeze', 'take_cover', 'call_for_backup', 'drop_weapon']
  );
  const english = 'The officer freezes, takes cover behind a wall, calls for backup, then lowers his pistol.';
  assert.deepEqual(
    extractSceneActionSequence(english).map(event => event.intent),
    ['freeze', 'take_cover', 'call_for_backup', 'drop_weapon']
  );
  assert.deepEqual(
    extractSceneActionSequence('The suspect raises both hands.').map(event => event.intent),
    ['hands_up']
  );
});

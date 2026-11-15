import test from 'node:test';
import assert from 'node:assert/strict';
import { inferEnvironmentMotion } from '../src/environment-motion.js';
import { buildStoryboardFromText } from '../src/storyboard-generator.js';

test('extracts explicit cloud, wind, and tree movement in Russian', () => {
  const cues = inferEnvironmentMotion('Кель идёт по поляне. Облака плывут по небу, ветер качает деревья и листья падают на землю.', 'ru');
  assert.equal(cues.length, 1);
  assert.match(cues[0], /Облака плывут/);
  assert.match(cues[0], /ветер качает деревья/);
});

test('extracts explicit sky and background movement in English', () => {
  const cues = inferEnvironmentMotion('Kel watches the clearing. Clouds drift across the sky while birds fly between the trees.', 'en');
  assert.equal(cues.length, 1);
  assert.match(cues[0], /Clouds drift/);
  assert.match(cues[0], /birds fly/);
});

test('supports Ukrainian and Spanish environment motion', () => {
  assert.match(inferEnvironmentMotion('Хмари пливуть небом, а вітер гойдає дерева.', 'uk')[0], /Хмари пливуть/);
  assert.match(inferEnvironmentMotion('Las nubes se mueven por el cielo y las hojas caen.', 'es')[0], /nubes se mueven/);
});

test('does not invent movement from a static environment description', () => {
  assert.deepEqual(inferEnvironmentMotion('Тихий лес, высокие деревья и голубое небо.', 'ru'), []);
});

test('does not treat character-only movement as environment motion', () => {
  assert.deepEqual(inferEnvironmentMotion('Кель бежит по поляне и прыгает через ветку.', 'ru'), []);
});

test('storyboard carries source-grounded environment motion into production scenes', () => {
  const plan = buildStoryboardFromText(
    'Кель приходит на лесную поляну. Облака плывут по небу, ветер качает деревья. Кель освобождает светящуюся птицу.',
    'ru',
    'Кель'
  );
  const cues = plan.scenes.flatMap(scene => scene.environmentMotion ?? []);
  assert.ok(cues.some(cue => /Облака плывут/.test(cue)));
  assert.ok(cues.some(cue => /ветер качает деревья/.test(cue)));
});

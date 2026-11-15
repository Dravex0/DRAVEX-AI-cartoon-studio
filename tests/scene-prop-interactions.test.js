import test from 'node:test';
import assert from 'node:assert/strict';
import { inferPropInteractions } from '../src/scene-prop-interactions.js';
import { buildStoryboardFromText } from '../src/storyboard-generator.js';

test('extracts a Russian character lifting and freeing named props', () => {
  const interactions = inferPropInteractions(
    'Кель осторожно поднимает тяжёлую ветку. Затем Кель освобождает светящуюся механическую птицу под упавшей веткой.',
    ['Кель'],
    'ru'
  );
  assert.equal(interactions.length, 2);
  assert.equal(interactions[0].type, 'lift');
  assert.equal(interactions[0].actorId, 'Кель');
  assert.match(interactions[0].targetId, /тяжёлую ветку/);
  assert.equal(interactions[1].type, 'free');
  assert.match(interactions[1].targetId, /светящуюся механическую птицу/);
});

test('extracts English and Ukrainian object interactions', () => {
  const english = inferPropInteractions('Kel gently opens the old wooden door.', ['Kel'], 'en');
  assert.equal(english[0].type, 'open');
  assert.match(english[0].targetId, /old wooden door/);
  const ukrainian = inferPropInteractions('Кель обережно піднімає важку гілку.', ['Кель'], 'uk');
  assert.equal(ukrainian[0].type, 'lift');
  assert.match(ukrainian[0].targetId, /важку гілку/);
});

test('does not infer an interaction without a named actor and explicit object', () => {
  assert.deepEqual(inferPropInteractions('Ветка лежит на земле.', ['Кель'], 'ru'), []);
  assert.deepEqual(inferPropInteractions('Кель осторожно осматривает поляну.', ['Кель'], 'ru'), []);
});

test('storyboard carries prop interactions into the final production scene', () => {
  const plan = buildStoryboardFromText(
    'Кель приходит на поляну. Кель осторожно поднимает упавшую ветку и освобождает маленькую механическую птицу.',
    'ru',
    'Кель'
  );
  const interactions = plan.scenes.flatMap(scene => scene.interactions ?? []);
  assert.ok(interactions.some(item => item.type === 'lift' && /упавшую ветку/.test(item.targetId)));
  assert.ok(interactions.some(item => item.type === 'free' && /механическую птицу/.test(item.targetId)));
});

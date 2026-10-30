import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyStoryEvent, directStoryEvent } from '../src/story-event-director.js';

const cases = [
  ['ru', 'Лисёнок находит серебряный ключ.', 'discovery'],
  ['ru', 'Сова показывает скрытую тропу.', 'guidance_help'],
  ['ru', 'Герой ремонтирует старый механизм.', 'repair_build'],
  ['ru', 'Волк преследует героя по лесу.', 'threat_conflict'],
  ['ru', 'В саду расцветают волшебные цветы.', 'transformation'],
  ['uk', 'Робот лагодить старий поливальний механізм.', 'repair_build'],
  ['uk', 'Птах показує Мико дорогу додому.', 'guidance_help'],
  ['uk', 'Герой перетинає міст над річкою.', 'travel_movement'],
  ['en', 'A young dragon discovers a map.', 'discovery'],
  ['en', 'A storm blocks the mountain pass.', 'threat_conflict'],
  ['en', 'A glowing bird guides Pip home.', 'guidance_help'],
  ['en', 'The robot repairs the broken gate.', 'repair_build'],
  ['en', 'The garden transforms into a field of light.', 'transformation'],
  ['en', 'The fox runs across the bridge.', 'travel_movement'],
  ['en', 'The child smiles with relief.', 'emotional_reaction'],
  ['es', 'El zorro encuentra una llave.', 'discovery'],
  ['es', 'La tormenta bloquea el camino.', 'threat_conflict'],
  ['es', 'El ave guía al niño a casa.', 'guidance_help']
];

test('classifies common story events in Russian, Ukrainian, English, and Spanish', () => {
  for (const [language, detail, expected] of cases) {
    assert.equal(classifyStoryEvent(detail, language), expected, detail);
  }
});

test('returns a visible action and matching localized camera plan', () => {
  const direction = directStoryEvent('Лисёнок находит серебряный ключ.', 'ru', 'Лисёнок');
  assert.equal(direction.eventType, 'discovery');
  assert.match(direction.visibleAction, /Лисёнок/);
  assert.match(direction.camera, /крупный план/);
  assert.equal(direction.sourceDetail, 'Лисёнок находит серебряный ключ.');
});

test('uses a safe general direction for unknown language and empty details', () => {
  assert.equal(classifyStoryEvent('', 'fr'), 'general');
  const direction = directStoryEvent('A mysterious event happens.', 'fr', '');
  assert.equal(direction.eventType, 'general');
  assert.match(direction.visibleAction, /character/);
  assert.ok(direction.camera.length > 0);
});

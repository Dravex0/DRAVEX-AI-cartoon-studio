import test from 'node:test';
import assert from 'node:assert/strict';
import { inferSceneCausalLinks } from '../src/scene-causality.js';
import { buildStoryboardFromText } from '../src/storyboard-generator.js';

test('extracts an explicit English consequence and binds it to prior source evidence', () => {
  const links = inferSceneCausalLinks([
    { id: 'scene_1', storyDetail: 'The bridge collapses.' },
    { id: 'scene_2', storyDetail: 'As a result, the travelers take the forest path.' }
  ], 'en');
  assert.equal(links[0], null);
  assert.deepEqual(links[1], {
    type: 'consequence',
    causeSceneId: 'scene_1',
    effectSceneId: 'scene_2',
    marker: 'As a result',
    causeEvidence: 'The bridge collapses.',
    evidence: 'As a result, the travelers take the forest path.'
  });
});

test('supports explicit Russian and Ukrainian consequence markers', () => {
  const russian = inferSceneCausalLinks([
    { id: 'a', storyDetail: 'Мост разрушился.' },
    { id: 'b', storyDetail: 'Поэтому путники пошли через лес.' }
  ], 'ru');
  const ukrainian = inferSceneCausalLinks([
    { id: 'a', storyDetail: 'Міст зруйнувався.' },
    { id: 'b', storyDetail: 'Через це мандрівники пішли лісом.' }
  ], 'uk');
  assert.equal(russian[1].causeSceneId, 'a');
  assert.equal(russian[1].marker.toLocaleLowerCase(), 'поэтому');
  assert.equal(ukrainian[1].causeSceneId, 'a');
  assert.equal(ukrainian[1].marker.toLocaleLowerCase(), 'через це');
});

test('does not invent a causal link without an explicit marker or source evidence', () => {
  const links = inferSceneCausalLinks([
    { id: 'a', storyDetail: 'The bridge collapses.' },
    { id: 'b', storyDetail: 'The travelers enter the forest.' },
    { id: 'c', storyDetail: '' }
  ], 'en');
  assert.deepEqual(links, [null, null, null]);
});

test('storyboard generation attaches explicit source causality to the consequence scene', () => {
  const plan = buildStoryboardFromText(
    'The bridge collapses. As a result, the travelers take the forest path.',
    'en', 'Foxy'
  );
  const effect = plan.scenes.find(scene => scene.causalLink);
  assert.ok(effect);
  assert.equal(effect.causalLink.type, 'consequence');
  assert.equal(effect.causalLink.effectSceneId, effect.id);
  assert.ok(effect.causalLink.causeEvidence.includes('The bridge collapses'));
});

test('links to the previous source-backed scene when storyboard beats are empty', () => {
  const links = inferSceneCausalLinks([
    { id: 'a', storyDetail: 'The bridge collapses.' },
    { id: 'b', storyDetail: '' },
    { id: 'c', storyDetail: 'Therefore, the travelers turn back.' }
  ], 'en');
  assert.equal(links[0], null);
  assert.equal(links[1], null);
  assert.equal(links[2].causeSceneId, 'a');
});


test('recognizes additional explicit consequence markers in all supported languages', () => {
  const cases = [
    ['en', 'The alarm rings.', 'As a consequence, the guard wakes up.'],
    ['en', 'The bridge is blocked.', 'Due to this, the travelers turn back.'],
    ['ru', 'Дверь заперта.', 'По этой причине герой ищет другой вход.'],
    ['ru', 'Мост разрушен.', 'В результате этого путники идут через лес.'],
    ['uk', 'Дорога затоплена.', 'З цієї причини мандрівники повертаються.'],
    ['uk', 'Міст зруйнований.', 'У результаті цього герої шукають обхід.'],
    ['es', 'La puerta está cerrada.', 'Como consecuencia, buscan otra entrada.'],
    ['es', 'El puente está bloqueado.', 'Debido a esto, los viajeros regresan.']
  ];
  for (const [language, cause, effect] of cases) {
    const links = inferSceneCausalLinks([
      { id: 'cause', storyDetail: cause },
      { id: 'effect', storyDetail: effect }
    ], language);
    assert.equal(links[1]?.causeSceneId, 'cause', effect);
    assert.equal(links[1]?.effectSceneId, 'effect', effect);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneFilmMemory } from '../src/scene-film-memory.js';

const scenes = [
  { id: 's1', title: 'The key', characters: ['Mira'], location: 'village',
    startState: { characters: { Mira: { location: 'village' } }, objects: { key: { owner: 'Mira' } } },
    endState: { characters: { Mira: { location: 'village' } }, objects: { key: { owner: 'Mira' } } },
    stateChanges: [] },
  { id: 's2', title: 'The handoff', characters: ['Mira', 'Leo'], location: 'bridge',
    startState: { characters: { Mira: { location: 'bridge' }, Leo: { location: 'bridge' } }, objects: { key: { owner: 'Leo' } } },
    endState: { characters: { Mira: { location: 'bridge' }, Leo: { location: 'bridge' } }, objects: { key: { owner: 'Leo' } } },
    stateChanges: [{ entity: 'key', property: 'owner', previousValue: 'Mira', value: 'Leo',
      actorId: 'Mira', evidence: 'Mira gives Leo the key.' }] }
];

test('joins characters, props, physical handoffs, causal links and state into ordered film memory', () => {
  const memory = buildSceneFilmMemory(scenes, {
    worldModel: {
      entities: [
        { id: 'Mira', kind: 'character', scenes: ['s1', 's2'], attributes: {} },
        { id: 'Leo', kind: 'character', scenes: ['s2'], attributes: {} },
        { id: 'key', kind: 'prop', scenes: ['s1', 's2'], attributes: {} }
      ],
      relations: [{ sceneId: 's2', from: 'Mira', to: 'Leo', type: 'acts_on', action: 'give' }],
      events: [{ sceneId: 's2', actions: [{ type: 'give', actorId: 'Mira', targetId: 'Leo',
        description: 'Mira gives Leo the key.', evidence: 'Mira gives Leo the key.' }] }]
    },
    physicsModel: {
      events: [{ id: 'p1', sceneId: 's2', type: 'transfer', entityId: 'key',
        actorId: 'Mira', grounded: true, evidence: 'Mira gives Leo the key.' }],
      holderTimeline: [{ eventId: 'p1', sceneId: 's2', entityId: 'key',
        holderBefore: 'Mira', holderAfter: 'Leo', transition: 'holder-transferred' }]
    },
    causalModel: {
      events: [{ id: 'c1', sceneId: 's2', type: 'action', actorId: 'Mira',
        targetId: 'Leo', grounded: true, evidence: 'Mira gives Leo the key.' }],
      edges: [{ fromEventId: 'c0', toEventId: 'c1', fromSceneId: 's1', toSceneId: 's2' }],
      chains: [{ id: 'chain-1', eventIds: ['c0', 'c1'] }]
    },
    stateContinuity: { passed: true, checkedTransitions: 1, issues: [] }
  });

  assert.equal(memory.valid, true);
  assert.equal(memory.sceneCount, 2);
  assert.deepEqual(memory.scenes.map(scene => scene.sceneId), ['s1', 's2']);
  assert.equal(memory.scenes[1].characters.length, 2);
  assert.equal(memory.scenes[1].objects[0].id, 'key');
  assert.equal(memory.scenes[1].holderTransitions[0].holderAfter, 'Leo');
  assert.equal(memory.scenes[1].causalEdges[0].toEventId, 'c1');
  assert.equal(memory.scenes[1].state.changes[0].value, 'Leo');
  assert.equal(memory.continuity.passed, true);
  assert.equal(memory.causalChains[0].eventIds.length, 2);
});

test('keeps missing facts unknown and never infers causality from adjacent scenes', () => {
  const memory = buildSceneFilmMemory([
    { id: 'a', characters: ['Mira'] },
    { id: 'b', characters: ['Mira'] }
  ], {});
  assert.equal(memory.valid, true);
  assert.equal(memory.scenes[0].environment.location, null);
  assert.equal(memory.scenes[0].state.start, null);
  assert.deepEqual(memory.scenes[0].causalEdges, []);
  assert.deepEqual(memory.scenes[1].causalEdges, []);
  assert.equal(memory.scenes[0].timeline.length, 0);
});

test('preserves source model ordering when event timing is unknown', () => {
  const memory = buildSceneFilmMemory([{ id: 's1' }], {
    physicsModel: { events: [
      { id: 'p2', sceneId: 's1', type: 'push', sequence: 2, grounded: true },
      { id: 'p1', sceneId: 's1', type: 'grasp', sequence: 1, grounded: true }
    ] }
  });
  assert.deepEqual(memory.scenes[0].timeline.map(event => event.sourceId), ['p1', 'p2']);
});

test('rejects duplicate scene IDs rather than silently merging scene memories', () => {
  const memory = buildSceneFilmMemory([{ id: 'same' }, { id: 'same' }]);
  assert.equal(memory.valid, false);
  assert.equal(memory.sceneCount, 0);
  assert.equal(memory.issues[0].code, 'duplicate-film-scene-id');
});

test('reports relation endpoints absent from a non-empty world model', () => {
  const memory = buildSceneFilmMemory([{ id: 's1' }], {
    worldModel: {
      entities: [{ id: 'Mira', kind: 'character', scenes: ['s1'] }],
      relations: [{ sceneId: 's1', from: 'Mira', to: 'unknown', type: 'acts_on' }]
    }
  });
  assert.equal(memory.valid, true);
  assert.equal(memory.issues.length, 1);
  assert.equal(memory.issues[0].code, 'film-relation-entity-unresolved');
  assert.equal(memory.issues[0].entityId, 'unknown');
});

test('attaches continuity warnings to both adjacent scenes without inventing a fix', () => {
  const memory = buildSceneFilmMemory([{ id: 's1' }, { id: 's2' }], {
    stateContinuity: { passed: false, checkedTransitions: 1,
      issues: [{ code: 'character-teleportation', severity: 'warning',
        previousSceneId: 's1', sceneId: 's2', characterId: 'Mira' }] }
  });
  assert.equal(memory.scenes[0].continuityIssues.length, 1);
  assert.equal(memory.scenes[1].continuityIssues.length, 1);
  assert.equal(memory.continuity.passed, false);
});

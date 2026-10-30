import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStoryEventChain } from '../src/story-event-chain.js';

test('builds scene event nodes without inventing missing participants or reactions', () => {
  const graph = buildStoryEventChain([
    { id: 's1', storyEventType: 'discovery', storyDetail: 'Foxy finds a silver key.', characters: ['Foxy'] },
    { id: 's2', storyEventType: 'general', storyDetail: 'The forest grows dark.', characters: ['Foxy'] }
  ]);
  assert.equal(graph.sceneCount, 2);
  assert.equal(graph.nodes[0].eventType, 'discovery');
  assert.deepEqual(graph.nodes[0].participants, ['Foxy']);
  assert.equal(graph.nodes[0].action, null);
  assert.equal(graph.nodes[1].reaction, null);
  assert.deepEqual(graph.edges, []);
});

test('creates a directed interaction edge only when both named participants are in the scene cast', () => {
  const graph = buildStoryEventChain([{
    id: 's1', storyEventType: 'guidance_help', storyDetail: 'Bird guides Foxy home.',
    characters: ['Bird', 'Foxy'],
    interaction: { type: 'guide', actorId: 'Bird', targetId: 'Foxy', evidence: 'Bird guides Foxy' }
  }]);
  assert.deepEqual(graph.edges, [{
    type: 'directed_interaction', fromSceneId: 's1',
    actorId: 'Bird', targetId: 'Foxy', evidence: 'Bird guides Foxy'
  }]);
  assert.equal(graph.nodes[0].action.actorId, 'Bird');
  assert.equal(graph.nodes[0].action.targetId, 'Foxy');
});

test('ignores interaction metadata when a participant is not assigned to the scene', () => {
  const graph = buildStoryEventChain([{
    id: 's1', storyEventType: 'guidance_help', storyDetail: 'Bird guides Foxy home.',
    characters: ['Bird', 'Foxy'],
    interaction: { type: 'guide', actorId: 'Wolf', targetId: 'Foxy', evidence: 'Wolf guides Foxy' }
  }]);
  assert.equal(graph.nodes[0].action, null);
  assert.deepEqual(graph.edges, []);
});

test('links a consequence only when its source scene and effect scene are present', () => {
  const graph = buildStoryEventChain([
    { id: 's1', storyEventType: 'general', storyDetail: 'The bridge collapses.' },
    { id: 's2', storyEventType: 'travel_movement', storyDetail: 'Therefore, the travelers take the forest path.',
      causalLink: {
        type: 'consequence', causeSceneId: 's1', effectSceneId: 's2',
        marker: 'Therefore', causeEvidence: 'The bridge collapses.',
        evidence: 'Therefore, the travelers take the forest path.'
      } }
  ]);
  assert.ok(graph.edges.some(edge => edge.type === 'causes' && edge.fromSceneId === 's1' && edge.toSceneId === 's2'));
  assert.equal(graph.nodes[1].consequence.causeSceneId, 's1');
});

test('rejects a causal edge whose cause scene is absent or effect ID is mismatched', () => {
  const graph = buildStoryEventChain([{
    id: 's2', storyEventType: 'general', storyDetail: 'Therefore, the travelers leave.',
    causalLink: {
      type: 'consequence', causeSceneId: 'missing', effectSceneId: 'other',
      marker: 'Therefore', causeEvidence: 'The bridge collapses.',
      evidence: 'Therefore, the travelers leave.'
    }
  }]);
  assert.equal(graph.nodes[0].consequence, null);
  assert.deepEqual(graph.edges, []);
});

test('records explicit state changes and explicit reactions without guessing their cause', () => {
  const graph = buildStoryEventChain([{
    id: 's1', storyEventType: 'emotional_reaction', storyDetail: 'Foxy picks up the silver key, then smiles with relief.',
    characters: ['Foxy'],
    stateChanges: [{
      entityType: 'prop', entityId: 'silver key', property: 'holder',
      previousValue: null, value: 'Foxy', actorId: 'Foxy',
      evidence: 'Foxy picks up the silver key.'
    }]
  }]);
  assert.deepEqual(graph.nodes[0].reaction, {
    type: 'emotional_reaction', evidence: 'Foxy smiles with relief.'
  });
  assert.ok(graph.edges.some(edge => edge.type === 'changes_state' && edge.actorId === 'Foxy'));
  assert.equal(graph.edges.some(edge => edge.type === 'reacts_to'), false);
});

test('links an explicit reaction to its stated cause, not merely the previous scene', () => {
  const graph = buildStoryEventChain([
    { id: 's1', storyEventType: 'threat_conflict', storyDetail: 'The wolf blocks the path.' },
    { id: 's2', storyEventType: 'emotional_reaction', storyDetail: 'As a result, Foxy becomes frightened.',
      causalLink: {
        type: 'consequence', causeSceneId: 's1', effectSceneId: 's2',
        marker: 'As a result', causeEvidence: 'The wolf blocks the path.',
        evidence: 'As a result, Foxy becomes frightened.'
      } }
  ]);
  assert.ok(graph.edges.some(edge => edge.type === 'reacts_to' && edge.fromSceneId === 's2' && edge.toSceneId === 's1'));
});


test('does not create graph edges from interaction or state evidence absent from the scene source', () => {
  const graph = buildStoryEventChain([{
    id: 's1', storyEventType: 'guidance_help', storyDetail: 'Bird looks toward Foxy.',
    characters: ['Bird', 'Foxy'],
    interaction: { type: 'guide', actorId: 'Bird', targetId: 'Foxy', evidence: 'Bird secretly guides Foxy' },
    stateChanges: [{
      entityType: 'prop', entityId: 'silver key', property: 'holder',
      previousValue: null, value: 'Bird', actorId: 'Bird',
      evidence: 'Bird picks up the silver key.'
    }]
  }]);
  assert.equal(graph.nodes[0].action, null);
  assert.deepEqual(graph.nodes[0].stateChanges, []);
  assert.deepEqual(graph.edges, []);
});

test('does not create a causal edge when cause or effect evidence is not present in its source scene', () => {
  const graph = buildStoryEventChain([
    { id: 's1', storyEventType: 'general', storyDetail: 'The bridge remains open.' },
    { id: 's2', storyEventType: 'general', storyDetail: 'Therefore, the travelers take the forest path.',
      causalLink: {
        type: 'consequence', causeSceneId: 's1', effectSceneId: 's2',
        marker: 'Therefore', causeEvidence: 'The bridge collapses.',
        evidence: 'Therefore, the travelers take the forest path.'
      } }
  ]);
  assert.equal(graph.nodes[1].consequence, null);
  assert.equal(graph.edges.some(edge => edge.type === 'causes'), false);
});

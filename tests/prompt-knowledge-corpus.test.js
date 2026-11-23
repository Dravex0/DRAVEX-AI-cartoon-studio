import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePromptKnowledgeCorpus, PROMPT_KNOWLEDGE_INTENTS } from '../src/prompt-knowledge-corpus.js';
import { inferSceneActionIntent } from '../src/scene-action.js';
import { understandScenePrompt, formatSceneUnderstandingForMotion } from '../src/scene-understanding.js';

test('generates 10,000 unique prompt-to-action examples across four languages and 32 intents', () => {
  const corpus = generatePromptKnowledgeCorpus();
  assert.equal(corpus.length, 10000);
  assert.equal(new Set(corpus.map(item => item.prompt)).size, 10000);
  assert.deepEqual(new Set(corpus.map(item => item.locale)), new Set(['en', 'ru', 'uk', 'es']));
  assert.equal(PROMPT_KNOWLEDGE_INTENTS.length, 32);
  for (const intent of PROMPT_KNOWLEDGE_INTENTS) {
    assert.ok(corpus.some(item => item.expectedIntent === intent), 'missing corpus coverage: ' + intent);
  }
});

test('all 10,000 corpus prompts resolve to their expected semantic action', () => {
  const corpus = generatePromptKnowledgeCorpus();
  const failures = [];
  for (const example of corpus) {
    const actual = inferSceneActionIntent(example.prompt).intent;
    if (actual !== example.expectedIntent) failures.push({ id: example.id, locale: example.locale, expected: example.expectedIntent, actual, prompt: example.prompt });
    if (failures.length >= 12) break;
  }
  assert.deepEqual(failures, []);
});

test('understands named characters, objects, perception and directed interactions without inventing targets', () => {
  const understanding = understandScenePrompt(
    'Foxy sees the key, hears a noise, picks up the key and gives it to Bird.',
    { characters: ['Foxy', 'Bird'], interactions: [{ type: 'give', actorId: 'Foxy', targetId: 'Bird', evidence: 'gives it to Bird' }], locale: 'en' }
  );
  assert.ok(understanding.entities.some(item => item.id === 'Foxy' && item.type === 'character'));
  assert.ok(understanding.entities.some(item => item.id === 'Bird' && item.type === 'character'));
  assert.ok(understanding.entities.some(item => item.id === 'key' && item.type === 'object'));
  assert.ok(understanding.perception.some(item => item.type === 'visual_attention'));
  assert.ok(understanding.perception.some(item => item.type === 'auditory_attention'));
  assert.ok(understanding.perception.some(item => item.type === 'touch_contact'));
  assert.equal(understanding.interactions[0].targetId, 'Bird');
  assert.match(formatSceneUnderstandingForMotion(understanding), /Foxy -> Bird/);
});

test('does not claim visual detection when the prompt contains no perception evidence', () => {
  const understanding = understandScenePrompt('Foxy stands beside the old tree.', { characters: ['Foxy'], locale: 'en' });
  assert.equal(understanding.perception.length, 0);
  assert.equal(understanding.entities.length, 1);
  assert.match(formatSceneUnderstandingForMotion(understanding), /Perception cues: none explicitly stated/);
});

test('keeps a missing interaction target unresolved instead of guessing', () => {
  const understanding = understandScenePrompt('Foxy attacks a shadow.', { characters: ['Foxy'], locale: 'en' });
  assert.ok(understanding.unresolved.some(item => item.intent === 'attack'));
  assert.equal(understanding.interactions.length, 0);
});


test('retrieves locale- and intent-matched examples from the 10k corpus for downstream generation', async () => {
  const { retrievePromptKnowledgeExamples } = await import('../src/prompt-knowledge-corpus.js');
  const examples = retrievePromptKnowledgeExamples('Foxy chases Bird through the forest.', {
    intent: 'chase', locale: 'en', limit: 2
  });
  assert.equal(examples.length, 2);
  assert.ok(examples.every(item => item.intent === 'chase' && item.locale === 'en'));
  assert.ok(examples.every(item => item.prompt.includes('chases')));
  assert.ok(examples.every(item => Number.isFinite(item.similarity)));
});

test('attaches retrieved prompt examples to scene understanding without treating them as story facts', () => {
  const understanding = understandScenePrompt('Foxy chases Bird through the forest.', {
    characters: ['Foxy', 'Bird'], locale: 'en'
  });
  assert.ok(understanding.referenceExamples.length > 0);
  assert.ok(understanding.referenceExamples.every(item => item.intent === 'chase'));
  assert.match(formatSceneUnderstandingForMotion(understanding), /Related knowledge examples/);
  assert.match(formatSceneUnderstandingForMotion(understanding), /guidance only, not scene facts/);
});

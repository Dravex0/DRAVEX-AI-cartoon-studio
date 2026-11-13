import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStoryboardFromText } from '../src/storyboard-generator.js';

function makeScene(language, actor, target, source) {
  return buildStoryboardFromText(
    `Characters:\n${actor} — a character.\n${target} — another character.\n\nScene 1: Clash\n${source}`,
    language,
    actor
  ).scenes[0];
}

function assertGroundedAttackThenReaction(scene, actor, target, reactionEvidence) {
  const phases = scene.actionTimeline.phases;
  assert.deepEqual(phases.map(({ phase, actorId, targetId, start, end }) => ({
    phase, actorId, targetId, start, end
  })), [
    { phase: 'action', actorId: actor, targetId: target, start: 0, end: 0.62 },
    { phase: 'reaction', actorId: target, targetId: actor, start: 0.62, end: 1 }
  ]);
  assert.equal(phases[1].evidence, reactionEvidence);
}

test('splits an explicitly described English reaction after “and” without punctuation', () => {
  const scene = makeScene('en', 'Kael', 'Nox', 'Kael strikes Nox and Nox stumbles backward.');
  assertGroundedAttackThenReaction(scene, 'Kael', 'Nox', 'and Nox stumbles backward.');
});

test('splits an explicitly described Russian reaction after “и” without punctuation', () => {
  const scene = makeScene('ru', 'Каэль', 'Рико', 'Каэль атакует Рико и Рико отшатывается назад.');
  assertGroundedAttackThenReaction(scene, 'Каэль', 'Рико', 'и Рико отшатывается назад.');
});

test('splits an explicitly described Ukrainian reaction after “і” without punctuation', () => {
  const scene = makeScene('uk', 'Ari', 'Noa', 'Ari атакує Noa і Noa відсахується назад.');
  assertGroundedAttackThenReaction(scene, 'Ari', 'Noa', 'і Noa відсахується назад.');
});

test('splits an explicitly described Spanish reaction after “y” without punctuation', () => {
  const scene = makeScene('es', 'Kael', 'Nox', 'Kael golpea a Nox y Nox se tambalea hacia atrás.');
  assertGroundedAttackThenReaction(scene, 'Kael', 'Nox', 'y Nox se tambalea hacia atrás.');
});

test('splits an explicitly described reaction in a following sentence', () => {
  const scene = makeScene('en', 'Kael', 'Nox', 'Kael strikes Nox. Nox stumbles backward.');
  assertGroundedAttackThenReaction(scene, 'Kael', 'Nox', 'Nox stumbles backward.');
});
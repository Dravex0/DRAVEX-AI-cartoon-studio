import { normalizeScenes } from './scene-model.js';
import { normalizeCharacterReference } from './character-reference.js';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'then', 'their', 'there', 'while', 'after', 'before',
  'он', 'она', 'они', 'это', 'этот', 'эта', 'для', 'при', 'его', 'её', 'ее', 'над', 'под', 'перед', 'после',
  'він', 'вона', 'вони', 'цей', 'ця', 'для', 'його', 'її', 'над', 'під', 'перед', 'після',
  'el', 'la', 'los', 'las', 'una', 'uno', 'con', 'para', 'por', 'del'
]);

const tokens = value => String(value ?? '').toLocaleLowerCase().normalize('NFKC')
  .match(/[\\p{L}\\p{N}]+/gu)?.filter(token => token.length > 2 && !STOP_WORDS.has(token)) ?? [];

function similarity(left, right) {
  const a = new Set(tokens(left));
  const b = new Set(tokens(right));
  if (!a.size || !b.size) return null;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return overlap / (a.size + b.size - overlap);
}

function percentage(value, total) {
  return total > 0 ? Math.round((value / total) * 100) : null;
}

/**
 * Text-level continuity checks for scene state and character references.
 * This cannot verify visual identity or understand synonyms in rendered frames.
 */
export function evaluateSceneContinuity({
  scenes: rawScenes,
  characterBible = [],
  minimumStateSimilarity = 0.2
} = {}) {
  const scenes = normalizeScenes(rawScenes);
  const profiles = (Array.isArray(characterBible) ? characterBible : [])
    .map(normalizeCharacterReference)
    .filter(profile => profile.characterId);
  const profileIds = new Set(profiles.map(profile => profile.characterId.toLocaleLowerCase()));
  const issues = [];

  const completeStates = scenes.filter(scene => scene.startState && scene.endState).length;
  for (const scene of scenes) {
    if (!scene.startState || !scene.endState) {
      issues.push({
        severity: 'warning',
        code: 'scene-state-incomplete',
        sceneId: scene.id,
        message: 'Add both a start state and an end state to make continuity testable.'
      });
    }
  }

  const transitions = [];
  for (let index = 1; index < scenes.length; index += 1) {
    const previous = scenes[index - 1];
    const current = scenes[index];
    if (!previous.endState || !current.startState) continue;
    const score = similarity(previous.endState, current.startState);
    if (score === null) continue;
    transitions.push(score);
    if (score < minimumStateSimilarity) {
      issues.push({
        severity: 'warning',
        code: 'state-transition-mismatch',
        sceneId: current.id,
        previousSceneId: previous.id,
        similarity: Math.round(score * 100),
        message: 'The next scene start state shares too little text with the previous scene end state; review the hand-off.'
      });
    }
  }

  let characterReferenceCoverage = null;
  if (profiles.length) {
    const characterOccurrences = scenes.flatMap(scene => scene.characters.map(characterId => ({
      sceneId: scene.id,
      characterId
    })));
    if (characterOccurrences.length) {
      const matched = characterOccurrences.filter(item => profileIds.has(item.characterId.toLocaleLowerCase()));
      characterReferenceCoverage = percentage(matched.length, characterOccurrences.length);
      for (const item of characterOccurrences) {
        if (!profileIds.has(item.characterId.toLocaleLowerCase())) {
          issues.push({
            severity: 'warning',
            code: 'character-reference-missing',
            sceneId: item.sceneId,
            characterId: item.characterId,
            message: 'This scene character has no matching entry in the character reference library.'
          });
        }
      }
    }
  }

  const stateCoverage = percentage(completeStates, scenes.length);
  const stateTransitionConsistency = transitions.length
    ? Math.round(transitions.reduce((sum, score) => sum + score, 0) / transitions.length * 100)
    : null;
  const metrics = { stateCoverage, stateTransitionConsistency, characterReferenceCoverage };
  const measured = Object.values(metrics).filter(value => value !== null);
  const overallScore = measured.length
    ? Math.round(measured.reduce((sum, value) => sum + value, 0) / measured.length)
    : null;

  return {
    schemaVersion: 1,
    evaluatedSceneCount: scenes.length,
    evaluatedTransitionCount: transitions.length,
    overallScore,
    metrics,
    passed: overallScore !== null && overallScore >= 85 && issues.length === 0,
    issues,
    limitations: [
      'Checks compare written scene notes; they do not inspect generated images or animation frames.',
      'Text similarity is lexical and may miss valid paraphrases or flag valid changes in wording.',
      'Character reference coverage checks IDs only, not whether the rendered character looks identical.'
    ]
  };
}

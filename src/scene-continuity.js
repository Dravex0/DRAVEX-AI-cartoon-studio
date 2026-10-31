import { normalizeScenes } from './scene-model.js';
import { normalizeCharacterReference } from './character-reference.js';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'then', 'their', 'there', 'while', 'after', 'before',
  'он', 'она', 'они', 'это', 'этот', 'эта', 'для', 'при', 'его', 'её', 'ее', 'над', 'под', 'перед', 'после',
  'він', 'вона', 'вони', 'цей', 'ця', 'для', 'його', 'її', 'над', 'під', 'перед', 'після',
  'el', 'la', 'los', 'las', 'una', 'uno', 'con', 'para', 'por', 'del'
]);

const IDENTITY_ANCHOR_FIELDS = Object.freeze([
  'visualDescription', 'species', 'ageRange', 'bodyShape', 'hair', 'eyeColor',
  'silhouette', 'clothing', 'colors', 'signatureAccessories', 'distinctiveFeatures'
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

function identityAnchors(profile) {
  return IDENTITY_ANCHOR_FIELDS.filter(field => Boolean(profile[field]));
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
  const profilesById = new Map();
  for (const profile of profiles) {
    const key = profile.characterId.toLocaleLowerCase();
    if (!profilesById.has(key)) profilesById.set(key, profile);
  }
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
  let characterIdentityAnchorCoverage = null;
  if (profiles.length) {
    const referencedCharacterIds = new Map();
    for (const scene of scenes) {
      for (const characterId of scene.characters) {
        const key = characterId.toLocaleLowerCase();
        if (!referencedCharacterIds.has(key)) {
          referencedCharacterIds.set(key, { characterId, sceneIds: [scene.id] });
        } else {
          referencedCharacterIds.get(key).sceneIds.push(scene.id);
        }
      }
    }

    if (referencedCharacterIds.size) {
      const matched = [...referencedCharacterIds.entries()]
        .filter(([key]) => profilesById.has(key));
      characterReferenceCoverage = percentage(matched.length, referencedCharacterIds.size);

      let adequatelyAnchored = 0;
      for (const [key, reference] of referencedCharacterIds) {
        const profile = profilesById.get(key);
        if (!profile) {
          for (const sceneId of reference.sceneIds) {
            issues.push({
              severity: 'warning',
              code: 'character-reference-missing',
              sceneId,
              characterId: reference.characterId,
              message: 'This scene character has no matching entry in the character reference library.'
            });
          }
          continue;
        }

        const anchors = identityAnchors(profile);
        if (anchors.length >= 2) {
          adequatelyAnchored += 1;
        } else {
          for (const sceneId of reference.sceneIds) {
            issues.push({
              severity: 'warning',
              code: 'character-identity-anchors-incomplete',
              sceneId,
              characterId: reference.characterId,
              anchorCount: anchors.length,
              missingFields: IDENTITY_ANCHOR_FIELDS.filter(field => !profile[field]),
              message: 'Add at least two stable visual identity details to this character profile before relying on it for cross-scene consistency.'
            });
          }
        }
      }
      characterIdentityAnchorCoverage = percentage(adequatelyAnchored, matched.length);
    }
  }

  const stateCoverage = percentage(completeStates, scenes.length);
  const stateTransitionConsistency = transitions.length
    ? Math.round(transitions.reduce((sum, score) => sum + score, 0) / transitions.length * 100)
    : null;
  const metrics = {
    stateCoverage,
    stateTransitionConsistency,
    characterReferenceCoverage,
    characterIdentityAnchorCoverage
  };
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
      'Character identity anchor coverage counts populated profile fields; it does not measure their accuracy or prove rendered visual consistency.'
    ]
  };
}

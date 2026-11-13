import { detectSceneAction } from './scene-action.js';

const escapeRegExp = value => String(value).replace(/[.*+?^{}|()[\]\\]/g, '\\$&');
const CLAUSE_BOUNDARIES = /(?<punctuation>[,;])|(?<sentenceEnd>[.!?。！？])|(?<conjunction>(?<![\p{L}\p{N}])(?:and|then|but|и|а|но|затем|потом|і|й|та|але|потім|y|e|pero|luego|entonces)(?![\p{L}\p{N}]))/giu;

function splitGroundedClauses(source) {
  const clauses = [];
  let start = 0;
  for (const match of source.matchAll(CLAUSE_BOUNDARIES)) {
    const conjunction = Boolean(match.groups?.conjunction);
    const includeSentenceEnd = Boolean(match.groups?.sentenceEnd);
    const end = includeSentenceEnd ? match.index + match[0].length : match.index;
    const text = source.slice(start, end);
    if (text.trim()) clauses.push({ text, start, end });
    // Keep conjunctions attached to the following clause so its evidence stays verbatim.
    start = conjunction ? match.index : match.index + match[0].length;
  }
  const text = source.slice(start);
  if (text.trim()) clauses.push({ text, start, end: source.length });
  return clauses;
}

function mentionedCharacters(text, characterIds) {
  const matches = [];
  for (const name of characterIds) {
    const pattern = new RegExp('(?<![\\p{L}\\p{N}])' + escapeRegExp(name) + '(?![\\p{L}\\p{N}])', 'giu');
    for (const match of text.matchAll(pattern)) {
      matches.push({ name, index: match.index, end: match.index + match[0].length });
    }
  }
  return matches.sort((a, b) => a.index - b.index);
}

/**
 * Recognize only an explicitly written attack followed by a target stagger.
 * Clause offsets are used to preserve source order; they are not animation timestamps.
 */
export function inferGroundedAttackReaction(source, characterIds, interactions) {
  const text = String(source ?? '');
  if (!text || !Array.isArray(characterIds) || !Array.isArray(interactions)) return null;
  const attack = interactions.find(item => item?.type === 'attack'
    && item.actorId && item.targetId
    && Number.isInteger(item.sourceStart) && Number.isInteger(item.sourceEnd));
  if (!attack) return null;

  const clauses = splitGroundedClauses(text);
  const reaction = clauses.find(clause => {
    const trimmed = clause.text.trim();
    return clause.start >= attack.sourceEnd && detectSceneAction(trimmed) === 'stagger';
  });
  if (!reaction) return null;

  const reactionEvidence = reaction.text.trim();
  const reactionMentions = mentionedCharacters(reactionEvidence, characterIds);
  const reactionActor = reactionMentions.at(-1)?.name;
  if (!reactionActor || reactionActor.toLocaleLowerCase() !== attack.targetId.toLocaleLowerCase()) return null;
  if (!text.includes(attack.evidence) || !text.includes(reactionEvidence)) return null;

  return {
    phases: [
      {
        phase: 'action',
        start: 0,
        end: 0.62,
        actorId: attack.actorId,
        targetId: attack.targetId,
        description: `${attack.actorId} performs the explicitly described attack: ${attack.evidence}`,
        evidence: attack.evidence
      },
      {
        phase: 'reaction',
        start: 0.62,
        end: 1,
        actorId: attack.targetId,
        targetId: attack.actorId,
        description: `${reactionActor} visibly staggers in response to the attack: ${reactionEvidence}`,
        evidence: reactionEvidence
      }
    ]
  };
}
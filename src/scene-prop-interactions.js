/**
 * Conservative actor-to-prop interaction extraction from explicit story sentences.
 * Target names are copied from source text; this is lexical parsing, not open-ended AI understanding.
 */
const VERBS = {
  en: [
    ['lift', /(?:lifts?|raises?|picks?\s+up|takes?|grabs?)/iu],
    ['open', /opens?/iu], ['close', /closes?/iu], ['free', /frees?|releases?|unties?/iu],
    ['push', /pushes?/iu], ['pull', /pulls?/iu], ['hold', /holds?|carries?/iu],
    ['touch', /touches?|pets?|strokes?/iu], ['hug', /hugs?/iu], ['drop', /drops?|releases?/iu]
  ],
  ru: [
    ['lift', /(?:поднима(?:ет|ют)|бер[её]т|забира(?:ет|ют))/iu],
    ['open', /открыва(?:ет|ют)/iu], ['close', /закрыва(?:ет|ют)/iu],
    ['free', /освобожда(?:ет|ют)|высвобожда(?:ет|ют)|выпуска(?:ет|ют)/iu],
    ['push', /толка(?:ет|ют)|отталкива(?:ет|ют)/iu], ['pull', /тянет|тащит/iu],
    ['hold', /держит|нес[её]т|держат/iu], ['touch', /касается|трогает|гладит/iu],
    ['hug', /обнима(?:ет|ют)/iu], ['drop', /роня(?:ет|ют)|отпуска(?:ет|ют)/iu]
  ],
  uk: [
    ['lift', /(?:підніма(?:є|ють)|бере|забира(?:є|ють))/iu],
    ['open', /відкрива(?:є|ють)/iu], ['close', /закрива(?:є|ють)/iu],
    ['free', /звільня(?:є|ють)|визволя(?:є|ють)|випуска(?:є|ють)/iu],
    ['push', /штовха(?:є|ють)|відштовху(?:є|ють)/iu], ['pull', /тягне|тягнуть/iu],
    ['hold', /трима(?:є|ють)|несе|несуть/iu], ['touch', /торкається|чіпає|гладить/iu],
    ['hug', /обійма(?:є|ють)/iu], ['drop', /роня(?:є|ють)|відпуска(?:є|ють)/iu]
  ],
  es: [
    ['lift', /(?:levanta|recoge|toma|agarra)/iu], ['open', /abre/iu], ['close', /cierra/iu],
    ['free', /libera|suelta/iu], ['push', /empuja/iu], ['pull', /tira|jala/iu],
    ['hold', /sostiene|lleva/iu], ['touch', /toca|acaricia/iu], ['hug', /abraza/iu], ['drop', /deja caer/iu]
  ]
};

const ADVERBS = /^(?:carefully|gently|slowly|quickly|firmly|осторожно|аккуратно|медленно|быстро|нежно|обережно|повільно|швидко|cuidadosamente|suavemente|lentamente)$/iu;
const PREPOSITIONS = /\s+(?:under|beneath|beside|near|on|onto|into|from|with|за|под|над|рядом|возле|около|из|в|на|біля|під|над|поруч|з|із|у|в|sobre|debajo|junto|cerca|desde|con)\s+/iu;
const ACTION_JOINERS = /\s+(?:and|then|и|а|затем|потом|та|і|y|luego)\s+/iu;
const ARTICLES = /^(?:the|a|an|этот|эта|это|эту|этого|этой|цей|ця|це|цю|el|la|los|las|un|una)\s+/iu;
const clean = value => String(value ?? '').trim().replace(/^[\s"'«»“”‘’]+|[\s"'«»“”‘’]+$/gu, '').slice(0, 120);

function actorPattern(name) {
  const escaped = [...name].map(char => /[.*+?^{}()|[\]\\]/u.test(char) ? '\\' + char : char).join('');
  return new RegExp('(?<![\\p{L}\\p{N}_])' + escaped + '(?![\\p{L}\\p{N}_])', 'iu');
}

export function inferPropInteractions(detail, characterIds = [], language = 'en') {
  const locale = Object.hasOwn(VERBS, language) ? language : 'en';
  const source = String(detail ?? '').trim();
  if (!source) return [];
  const actors = [...new Set((Array.isArray(characterIds) ? characterIds : []).map(clean).filter(Boolean))].slice(0, 12);
  if (!actors.length) return [];
  const sentences = [...source.matchAll(/[^.!?。！？]+[.!?。！？]?/gu)];
  const results = [];
  const seen = new Set();

  for (const sentenceMatch of sentences) {
    const sentence = sentenceMatch[0].trim();
    const baseOffset = sentenceMatch.index + sentenceMatch[0].indexOf(sentence);
    for (const actorId of actors) {
      const actor = actorPattern(actorId).exec(sentence);
      if (!actor) continue;
      const afterActor = sentence.slice(actor.index + actor[0].length);
      for (const [type, verbPattern] of VERBS[locale]) {
        const verb = verbPattern.exec(afterActor);
        if (!verb) continue;
        const prefix = afterActor.slice(0, verb.index).trim();
        const immediatePrefix = prefix.split(ACTION_JOINERS).at(-1).trim();
        if (!/^[\s,]*$/u.test(immediatePrefix) && !ADVERBS.test(immediatePrefix)) continue;
        let targetText = afterActor.slice(verb.index + verb[0].length).trim();
        if (!targetText) continue;
        targetText = targetText.split(ACTION_JOINERS)[0].split(PREPOSITIONS)[0].split(/[.!?,;:]/u)[0].replace(ARTICLES, '').trim();
        const targetId = clean(targetText);
        if (!targetId || targetId.length > 120 || targetId.toLocaleLowerCase() === actorId.toLocaleLowerCase()) continue;
        const key = actorId.toLocaleLowerCase() + '|' + type + '|' + targetId.toLocaleLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({
          type, actorId, targetId,
          evidence: sentence.slice(0, 500),
          sourceStart: baseOffset + actor.index,
          sourceEnd: baseOffset + sentence.length
        });
      }
    }
  }
  return results;
}

/**
 * Conservative extraction of explicit non-character movement from story text.
 * Returns source sentences as cues; it never invents wind, weather, crowds, or motion.
 */
const SUBJECTS = {
  en: /\b(?:clouds?|sky|wind|trees?|branches?|leaves?|birds?|rain|snow|waves?|water|crowds?|villagers?|people)\b/iu,
  ru: /(?:облак[\p{L}]*|неб[\p{L}]*|ветер[\p{L}]*|дерев[\p{L}]*|ветк[\p{L}]*|лист[\p{L}]*|птиц[\p{L}]*|дожд[\p{L}]*|снег[\p{L}]*|волн[\p{L}]*|вод[\p{L}]*|толп[\p{L}]*|люд[\p{L}]*)/iu,
  uk: /(?:хмар[\p{L}]*|неб[\p{L}]*|вітер[\p{L}]*|дерев[\p{L}]*|гілк[\p{L}]*|лист[\p{L}]*|птах[\p{L}]*|дощ[\p{L}]*|сніг[\p{L}]*|хвил[\p{L}]*|вод[\p{L}]*|натовп[\p{L}]*|люд[\p{L}]*)/iu,
  es: /\b(?:nubes?|cielo|viento|árbol[\p{L}]*|ramas?|hojas?|aves?|pájaros?|lluvia|nieve|olas?|agua|multitud|personas)\b/iu
};

const MOTION = {
  en: /\b(?:drift[\p{L}]*|move[\p{L}]*|sway[\p{L}]*|blow[\p{L}]*|fall[\p{L}]*|fly[\p{L}]*|cross[\p{L}]*|rise[\p{L}]*|shake[\p{L}]*|flutter[\p{L}]*|scatter[\p{L}]*|flow[\p{L}]*|wave[\p{L}]*)\b/iu,
  ru: /(?:движ[\p{L}]*|плыв[\p{L}]*|кач[\p{L}]*|колыш[\p{L}]*|ду[\p{L}]*|пада[\p{L}]*|лет[\p{L}]*|пролет[\p{L}]*|сып[\p{L}]*|шевел[\p{L}]*|теч[\p{L}]*|волну[\p{L}]*)/iu,
  uk: /(?:рух[\p{L}]*|плив[\p{L}]*|гойда[\p{L}]*|колиха[\p{L}]*|ду[\p{L}]*|пада[\p{L}]*|лет[\p{L}]*|проліта[\p{L}]*|сип[\p{L}]*|воруш[\p{L}]*|теч[\p{L}]*|хвилю[\p{L}]*)/iu,
  es: /\b(?:muev[\p{L}]*|desplaz[\p{L}]*|balance[\p{L}]*|sopl[\p{L}]*|cae[\p{L}]*|vuel[\p{L}]*|cruz[\p{L}]*|sub[\p{L}]*|agita[\p{L}]*|flot[\p{L}]*|flu[\p{L}]*)\b/iu
};

const clean = value => String(value ?? '').trim().slice(0, 700);

export function inferEnvironmentMotion(sourceText, language = 'en') {
  const locale = Object.hasOwn(SUBJECTS, language) ? language : 'en';
  const source = String(sourceText ?? '').trim();
  if (!source) return [];
  const sentences = source.match(/[^.!?。！？]+[.!?。！？]?/gu) ?? [source];
  const cues = [];
  const seen = new Set();
  for (const sentence of sentences) {
    const cue = clean(sentence);
    if (!cue || !SUBJECTS[locale].test(cue) || !MOTION[locale].test(cue)) continue;
    const key = cue.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cues.push(cue);
    if (cues.length >= 8) break;
  }
  return cues;
}

/**
 * Conservative extraction of explicit non-character movement from story text.
 * Returns source sentences as cues; it never invents wind, weather, crowds, or motion.
 */
const SUBJECTS = {
  en: /\b(?:clouds?|sky|wind|trees?|branches?|leaves?|birds?|rain|snow|waves?|water|crowds?|villagers?|people)\b/iu,
  ru: /(?:облак\w*|неб\w*|ветер\w*|дерев\w*|ветк\w*|лист\w*|птиц\w*|дожд\w*|снег\w*|волн\w*|вод\w*|толп\w*|люд\w*)/iu,
  uk: /(?:хмар\w*|неб\w*|вітер\w*|дерев\w*|гілк\w*|лист\w*|птах\w*|дощ\w*|сніг\w*|хвил\w*|вод\w*|натовп\w*|люд\w*)/iu,
  es: /\b(?:nubes?|cielo|viento|árbol\w*|ramas?|hojas?|aves?|pájaros?|lluvia|nieve|olas?|agua|multitud|personas)\b/iu
};

const MOTION = {
  en: /\b(?:drift\w*|move\w*|sway\w*|blow\w*|fall\w*|fly\w*|cross\w*|rise\w*|shake\w*|flutter\w*|scatter\w*|flow\w*|wave\w*)\b/iu,
  ru: /(?:движ\w*|плыв\w*|кач\w*|колыш\w*|ду\w*|пада\w*|лет\w*|пролет\w*|сып\w*|шевел\w*|теч\w*|волну\w*)/iu,
  uk: /(?:рух\w*|плив\w*|гойда\w*|колиха\w*|ду\w*|пада\w*|лет\w*|проліта\w*|сип\w*|воруш\w*|теч\w*|хвилю\w*)/iu,
  es: /\b(?:muev\w*|desplaz\w*|balance\w*|sopl\w*|cae\w*|vuel\w*|cruz\w*|sub\w*|agita\w*|flot\w*|flu\w*)\b/iu
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
